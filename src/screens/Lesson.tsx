import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Screen } from "../components/Screen";
import { getLesson, locateLesson, nextLessonAfter } from "../content";
import type { Lesson } from "../content/types";
import { addPhraseToReview, recordLesson } from "../lib/progress";
import { awardXp } from "../lib/progress";
import { useProgress } from "../lib/useProgress";
import { Conversation } from "./lesson/Conversation";
import { PhraseDrill, type DrillOutcome } from "./lesson/PhraseDrill";

type Done = { xpEarned: number; scores: number[] };

export function LessonScreen() {
  const { lessonId } = useParams();
  const [, update] = useProgress();
  const [done, setDone] = useState<Done | null>(null);
  const lesson = getLesson(lessonId);

  if (!lesson) return <Navigate to="/courses" replace />;

  const where = locateLesson(lesson.id);

  const completeDrill = (outcome: DrillOutcome) => {
    const scored = outcome.scores.filter((s) => s > 0);
    const best = scored.length ? Math.max(...scored) : null;
    update((p) => {
      // Completion is credited on attempts, never gated on score: gating on
      // recogniser agreement would punish accented-but-intelligible speech.
      let next = recordLesson(awardXp(p, lesson.xp), lesson.id, best);
      for (const phrase of outcome.weak) next = addPhraseToReview(next, phrase, lesson.id);
      return next;
    });
    setDone({ xpEarned: lesson.xp, scores: outcome.scores });
  };

  const completeConversation = () => {
    update((p) => recordLesson(awardXp(p, lesson.xp), lesson.id, null));
    setDone({ xpEarned: lesson.xp, scores: [] });
  };

  if (done) return <LessonResult lesson={lesson} done={done} />;

  return (
    <Screen titleJa={lesson.titleJa} subtitleJa={where?.unit.titleJa} back>
      {lesson.kind === "phrase" && (
        <PhraseDrill phrases={lesson.phrases} onFinish={completeDrill} />
      )}
      {lesson.kind === "roleplay" && (
        <Conversation
          mode="roleplay"
          level={lesson.level}
          lessonId={lesson.id}
          scenario={lesson.scenario}
          opening={{ en: lesson.openingLine, ja: lesson.openingLineJa }}
          keyPhrases={lesson.keyPhrases}
          maxTurns={lesson.maxTurns}
          onFinish={completeConversation}
        />
      )}
      {lesson.kind === "freetalk" && (
        <Conversation
          mode="freetalk"
          level={lesson.level}
          lessonId={lesson.id}
          topic={lesson.topic}
          starters={[...lesson.starters]}
          maxTurns={lesson.maxTurns}
          onFinish={completeConversation}
        />
      )}
    </Screen>
  );
}

function LessonResult({ lesson, done }: { lesson: Lesson; done: Done }) {
  const next = nextLessonAfter(lesson.id);
  const scored = done.scores.filter((s) => s > 0);
  const average = scored.length
    ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
    : null;

  return (
    <Screen titleJa="レッスン完了" back>
      <div className="rounded-2xl glass p-6 text-center">
        <p className="text-4xl">🎉</p>
        <h2 className="mt-2 text-lg font-bold">{lesson.titleJa}</h2>
        <p className="mt-1 text-xs text-ink-500">よくがんばりました！</p>
        <div className="mt-4 flex justify-center gap-6">
          <div>
            <p className="text-2xl font-bold tabular-nums text-brand-600">+{done.xpEarned}</p>
            <p className="text-[11px] text-ink-500">XP</p>
          </div>
          {average != null && (
            <div>
              <p className="text-2xl font-bold tabular-nums text-ink-800">{average}</p>
              <p className="text-[11px] text-ink-500">平均認識スコア</p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {next && (
          <Link
            to={`/lesson/${next.id}`}
            replace
            className="block rounded-xl glass-filled py-3 text-center text-sm font-semibold text-white press"
          >
            次のレッスンへ：{next.titleJa}
          </Link>
        )}
        <Link
          to="/"
          className="block rounded-xl border border-ink-400/25 bg-white py-3 text-center text-sm font-semibold text-ink-700 press"
        >
          ホームに戻る
        </Link>
      </div>
    </Screen>
  );
}
