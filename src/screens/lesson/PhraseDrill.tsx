import { useCallback, useMemo, useState } from "react";
import { ScoreDisclaimer, ScoreRing } from "../../components/ScoreRing";
import { SpeakInput } from "../../components/SpeakInput";
import { WordDiff } from "../../components/WordDiff";
import type { Phrase } from "../../content/types";
import { probeSpeechSupport } from "../../lib/speech/support";
import { useSpeechRecognition } from "../../lib/speech/useSpeechRecognition";
import { useSpeechSynthesis } from "../../lib/speech/useSpeechSynthesis";
import { scoreUtterance, type ScoreResult } from "../../lib/scoring";
import { GOOD_SCORE, WEAK_SCORE, XP_RULES, awardXp } from "../../lib/progress";
import { useProgress } from "../../lib/useProgress";

export type DrillOutcome = {
  /** Best score per phrase index, for the result summary. */
  scores: number[];
  /** Phrases the learner struggled with, queued for review. */
  weak: Phrase[];
};

type Props = {
  phrases: Phrase[];
  onFinish: (outcome: DrillOutcome) => void;
  /** Label for the finish action, e.g. "結果を見る". */
  finishLabelJa?: string;
};

export function PhraseDrill({ phrases, onFinish, finishLabelJa = "結果を見る" }: Props) {
  const [progress, update] = useProgress();
  const support = useMemo(() => probeSpeechSupport(), []);
  const tts = useSpeechSynthesis(progress.settings.voiceUri, progress.settings.speechRate);

  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [best, setBest] = useState<number[]>(() => phrases.map(() => 0));
  const [weak, setWeak] = useState<Phrase[]>([]);

  const current = phrases[index]!;

  const grade = useCallback(
    (transcript: string) => {
      const scored = scoreUtterance(current.en, transcript);
      setResult(scored);

      // An empty transcript is a mic failure, not a bad attempt: no score, no XP.
      if (scored.empty) return;

      setBest((prev) => {
        const next = [...prev];
        next[index] = Math.max(next[index] ?? 0, scored.score);
        return next;
      });

      if (scored.score < WEAK_SCORE) {
        setWeak((prev) =>
          prev.some((p) => p.en === current.en) ? prev : [...prev, current],
        );
      }

      const xp = XP_RULES.phraseAttempt + (scored.score >= GOOD_SCORE ? XP_RULES.phraseGoodBonus : 0);
      // awardXp also advances the streak, so one call covers both.
      update((p) =>
        awardXp({ ...p, stats: { ...p.stats, utterances: p.stats.utterances + 1 } }, xp),
      );
    },
    [current, index, update],
  );

  const stt = useSpeechRecognition(grade);

  const advance = () => {
    if (index + 1 >= phrases.length) {
      onFinish({ scores: best, weak });
      return;
    }
    setIndex(index + 1);
    setResult(null);
    stt.reset();
  };

  const retry = () => {
    setResult(null);
    stt.reset();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-400/15">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${((index + (result ? 1 : 0)) / phrases.length) * 100}%` }}
          />
        </div>
        <span className="text-[11px] font-medium tabular-nums text-ink-500">
          {index + 1} / {phrases.length}
        </span>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-[11px] font-medium text-ink-400">この文を声に出して読みましょう</p>
        <p className="mt-2 text-xl leading-relaxed font-semibold">{current.en}</p>
        {progress.settings.jaHintsVisible && (
          <p className="mt-2 text-xs leading-relaxed text-ink-500">{current.ja}</p>
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              tts.unlock();
              void tts.speak(current.en);
            }}
            className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 active:scale-95"
          >
            🔈 お手本を聞く
          </button>
          <button
            type="button"
            onClick={() => {
              tts.unlock();
              void tts.speak(current.en, { rate: 0.65 });
            }}
            className="rounded-lg bg-ink-400/10 px-3 py-2 text-xs font-semibold text-ink-600 active:scale-95"
          >
            🐢 ゆっくり
          </button>
        </div>
      </div>

      {result ? (
        <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm">
          {result.empty ? (
            <p className="text-center text-sm font-medium text-near">
              音声が聞き取れませんでした。もう一度お願いします。
            </p>
          ) : (
            <>
              <div className="flex justify-center">
                <ScoreRing score={result.score} />
              </div>
              <WordDiff words={result.words} />
              <ScoreDisclaimer />
            </>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={retry}
              className="flex-1 rounded-xl border border-brand-200 bg-white py-3 text-sm font-semibold text-brand-700 active:scale-[0.98]"
            >
              もう一度
            </button>
            <button
              type="button"
              onClick={advance}
              className="flex-1 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white active:scale-[0.98]"
            >
              {index + 1 >= phrases.length ? finishLabelJa : "次へ"}
            </button>
          </div>
        </div>
      ) : (
        <SpeakInput
          stt={stt}
          support={support}
          onSubmitText={grade}
          beforeStart={tts.cancel}
          placeholderJa="聞こえたとおりに入力…"
        />
      )}
    </div>
  );
}
