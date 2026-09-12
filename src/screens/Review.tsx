import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ScoreDisclaimer, ScoreRing } from "../components/ScoreRing";
import { Screen } from "../components/Screen";
import { SpeakInput } from "../components/SpeakInput";
import { WordDiff } from "../components/WordDiff";
import {
  GOOD_SCORE,
  XP_RULES,
  awardXp,
  dueReviewItems,
  gradeReviewItem,
  type ReviewItem,
} from "../lib/progress";
import { scoreUtterance, type ScoreResult } from "../lib/scoring";
import { probeSpeechSupport } from "../lib/speech/support";
import { useSpeechRecognition } from "../lib/speech/useSpeechRecognition";
import { useSpeechSynthesis } from "../lib/speech/useSpeechSynthesis";
import { useProgress } from "../lib/useProgress";

export function Review() {
  const [progress, update] = useProgress();
  const support = useMemo(() => probeSpeechSupport(), []);
  const tts = useSpeechSynthesis(progress.settings.voiceUri, progress.settings.speechRate);

  // Snapshotted once: grading mutates due dates, which would otherwise reshuffle
  // the queue underneath the learner mid-session.
  const [queue] = useState<ReviewItem[]>(() => dueReviewItems(progress));
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<ScoreResult | null>(null);

  const item = queue[index];

  const grade = (transcript: string) => {
    if (!item) return;
    const scored = scoreUtterance(item.en, transcript);
    setResult(scored);
    if (scored.empty) return;

    const passed = scored.score >= GOOD_SCORE;
    update((p) => {
      const graded = gradeReviewItem(p, item.id, passed);
      return passed ? awardXp(graded, XP_RULES.reviewCleared) : graded;
    });
  };

  const stt = useSpeechRecognition(grade);

  const advance = () => {
    setResult(null);
    stt.reset();
    setIndex((i) => i + 1);
  };

  if (queue.length === 0) {
    return (
      <Screen titleJa="復習" back>
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="text-4xl">🌤</p>
          <h2 className="mt-2 text-base font-bold">今は復習する項目がありません</h2>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">
            レッスンやフリートークで間違えた表現が、ここに自動でたまります。
          </p>
        </div>
        <Link
          to="/"
          className="block rounded-xl bg-brand-600 py-3 text-center text-sm font-semibold text-white active:scale-[0.98]"
        >
          ホームに戻る
        </Link>
      </Screen>
    );
  }

  if (!item) {
    return (
      <Screen titleJa="復習完了" back>
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="text-4xl">✅</p>
          <h2 className="mt-2 text-base font-bold">{queue.length} 件の復習が終わりました</h2>
          <p className="mt-1 text-xs text-ink-500">できた項目は、次はもう少し先に出てきます。</p>
        </div>
        <Link
          to="/"
          className="block rounded-xl bg-brand-600 py-3 text-center text-sm font-semibold text-white active:scale-[0.98]"
        >
          ホームに戻る
        </Link>
      </Screen>
    );
  }

  return (
    <Screen titleJa="復習" subtitleJa={`${index + 1} / ${queue.length}`} back>
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-[11px] font-medium text-ink-400">
          {item.kind === "correction" ? "添削された表現" : "苦手なフレーズ"}
          {item.timesWrong > 1 && `・${item.timesWrong} 回目`}
        </p>
        <p className="mt-2 text-xl leading-relaxed font-semibold">{item.en}</p>
        <p className="mt-2 text-xs leading-relaxed text-ink-500">{item.ja}</p>
        <button
          type="button"
          onClick={() => {
            tts.unlock();
            void tts.speak(item.en);
          }}
          className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 active:scale-95"
        >
          🔈 お手本を聞く
        </button>
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
              onClick={() => {
                setResult(null);
                stt.reset();
              }}
              className="flex-1 rounded-xl border border-brand-200 bg-white py-3 text-sm font-semibold text-brand-700 active:scale-[0.98]"
            >
              もう一度
            </button>
            <button
              type="button"
              onClick={advance}
              className="flex-1 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white active:scale-[0.98]"
            >
              次へ
            </button>
          </div>
        </div>
      ) : (
        <SpeakInput
          stt={stt}
          support={support}
          onSubmitText={grade}
          beforeStart={tts.cancel}
          placeholderJa="英語で入力…"
        />
      )}
    </Screen>
  );
}
