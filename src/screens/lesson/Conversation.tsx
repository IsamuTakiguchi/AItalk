import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatBubble, TypingBubble } from "../../components/ChatBubble";
import { CorrectionCard } from "../../components/CorrectionCard";
import { SpeakInput } from "../../components/SpeakInput";
import type { Phrase, Scenario } from "../../content/types";
import { ApiError, fetchTutorTurn } from "../../lib/api";
import { addCorrectionToReview, awardXp, XP_RULES } from "../../lib/progress";
import { probeSpeechSupport } from "../../lib/speech/support";
import { useSpeechRecognition } from "../../lib/speech/useSpeechRecognition";
import { useSpeechSynthesis } from "../../lib/speech/useSpeechSynthesis";
import { useProgress } from "../../lib/useProgress";
import type { Correction, Level } from "../../server/schemas";

type Turn = {
  role: "tutor" | "user";
  en: string;
  ja?: string;
  corrections?: Correction[];
  suggestions?: string[];
};

type Props = {
  mode: "freetalk" | "roleplay";
  level: Level;
  lessonId?: string;
  scenario?: Scenario;
  topic?: string;
  /** Static opening line, so a role play starts with no network round trip. */
  opening?: { en: string; ja: string };
  keyPhrases?: Phrase[];
  starters?: string[];
  maxTurns: number;
  onFinish: (turnsSpoken: number) => void;
};

export function Conversation({
  mode,
  level,
  lessonId,
  scenario,
  topic,
  opening,
  keyPhrases,
  starters,
  maxTurns,
  onFinish,
}: Props) {
  const [progress, update] = useProgress();
  const support = useMemo(() => probeSpeechSupport(), []);
  const tts = useSpeechSynthesis(progress.settings.voiceUri, progress.settings.speechRate);

  const [turns, setTurns] = useState<Turn[]>(() =>
    opening ? [{ role: "tutor", en: opening.en, ja: opening.ja }] : [],
  );
  const [busy, setBusy] = useState(false);
  const [errorJa, setErrorJa] = useState<string | null>(null);
  const [showJa, setShowJa] = useState(progress.settings.jaHintsVisible);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const spokenTurns = turns.filter((t) => t.role === "user").length;
  const atLimit = spokenTurns >= maxTurns;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (userText: string) => {
      if (busy || atLimit) return;
      setErrorJa(null);
      // Echo immediately: the structured tutor call is not streamed, so without
      // this the learner watches a blank screen for several seconds.
      const withUser: Turn[] = [...turns, { role: "user", en: userText }];
      setTurns(withUser);
      setBusy(true);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const turn = await fetchTutorTurn(
          {
            mode,
            level,
            scenario,
            topic,
            history: turns.map((t) => ({
              role: t.role === "tutor" ? ("assistant" as const) : ("user" as const),
              content: t.en,
            })),
            userText,
          },
          controller.signal,
        );

        setTurns([
          ...withUser,
          {
            role: "tutor",
            en: turn.reply,
            ja: turn.replyJa,
            corrections: turn.corrections,
            suggestions: turn.suggestions,
          },
        ]);

        update((p) => {
          let next = awardXp(
            { ...p, stats: { ...p.stats, talkTurns: p.stats.talkTurns + 1 } },
            XP_RULES.talkTurn,
          );
          for (const c of turn.corrections) next = addCorrectionToReview(next, c, lessonId);
          return next;
        });

        tts.unlock();
        void tts.speak(turn.reply);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErrorJa(err instanceof ApiError ? err.messageJa : "通信に失敗しました。");
        // Drop the optimistic echo so the learner can retry cleanly.
        setTurns(turns);
      } finally {
        setBusy(false);
      }
    },
    [atLimit, busy, lessonId, level, mode, scenario, topic, tts, turns, update],
  );

  const stt = useSpeechRecognition(send);
  const lastTutor = [...turns].reverse().find((t) => t.role === "tutor");
  const suggestions = lastTutor?.suggestions ?? (turns.length <= 1 ? starters : undefined);

  return (
    <div className="flex min-h-full flex-col">
      {scenario && (
        <div className="mb-3 rounded-xl border border-brand-200 bg-brand-50 p-3">
          <p className="text-[11px] font-bold text-brand-700">シーン：{scenario.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-600">
            あなたの役：{scenario.userRole}
            <br />
            相手：{scenario.tutorRole}
          </p>
          <p className="mt-1.5 text-xs font-medium text-ink-800">🎯 {scenario.goal}</p>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium text-ink-400">
          {spokenTurns} / {maxTurns} 往復
        </span>
        <button
          type="button"
          onClick={() => setShowJa((v) => !v)}
          className="text-[11px] font-medium text-brand-600 underline"
        >
          {showJa ? "日本語訳を隠す" : "日本語訳を見る"}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pb-2">
        {turns.map((turn, i) => (
          <div key={i} className="space-y-2">
            <ChatBubble
              role={turn.role}
              en={turn.en}
              ja={turn.ja}
              showJa={showJa}
              onSpeak={
                turn.role === "tutor"
                  ? () => {
                      tts.unlock();
                      void tts.speak(turn.en);
                    }
                  : undefined
              }
              speaking={tts.isSpeaking}
            />
            {turn.corrections?.map((c, j) => <CorrectionCard key={j} c={c} />)}
          </div>
        ))}
        {busy && <TypingBubble />}
      </div>

      {keyPhrases && keyPhrases.length > 0 && (
        <details className="mb-2 rounded-xl bg-white p-3 shadow-sm">
          <summary className="cursor-pointer text-xs font-semibold text-ink-600">
            使えるフレーズを見る
          </summary>
          <ul className="mt-2 space-y-1.5">
            {keyPhrases.map((p) => (
              <li key={p.en} className="text-xs">
                <span className="font-medium text-ink-800">{p.en}</span>
                <span className="ml-1 text-ink-500">{p.ja}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {errorJa && <p className="mb-2 text-center text-xs text-bad">{errorJa}</p>}

      <div className="sticky bottom-0 space-y-3 bg-[#f6f7fb] pt-2 pb-3">
        {atLimit ? (
          <button
            type="button"
            onClick={() => onFinish(spokenTurns)}
            className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white active:scale-[0.98]"
          >
            会話を終える
          </button>
        ) : (
          <>
            {suggestions && suggestions.length > 0 && !busy && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="shrink-0 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs text-ink-700 active:scale-95"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <SpeakInput
              stt={stt}
              support={support}
              busy={busy}
              onSubmitText={(t) => void send(t)}
              beforeStart={tts.cancel}
            />
            {spokenTurns > 0 && (
              <button
                type="button"
                onClick={() => onFinish(spokenTurns)}
                className="mx-auto block text-[11px] font-medium text-ink-400 underline"
              >
                ここで終える
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
