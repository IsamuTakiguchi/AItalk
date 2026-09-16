import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Screen } from "../components/Screen";
import { TALK_TOPICS } from "../content";
import { useProgress } from "../lib/useProgress";
import { Conversation } from "./lesson/Conversation";

export function TalkSession() {
  const { topicId } = useParams();
  const [progress] = useProgress();
  const [finished, setFinished] = useState<number | null>(null);
  const topic = TALK_TOPICS.find((t) => t.id === topicId);

  if (!topic) return <Navigate to="/talk" replace />;

  if (finished !== null) {
    return (
      <Screen titleJa="おつかれさまでした" back>
        <div className="rounded-2xl glass p-6 text-center">
          <p className="text-4xl">👏</p>
          <h2 className="mt-2 text-lg font-bold">{finished} 往復 話しました</h2>
          <p className="mt-1 text-xs text-ink-500">
            累計 {progress.stats.talkTurns} 往復・{progress.xp.total} XP
          </p>
        </div>
        <div className="space-y-2">
          <Link
            to="/talk"
            replace
            className="block rounded-xl glass-filled py-3 text-center text-sm font-semibold text-white press"
          >
            別の話題で話す
          </Link>
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

  return (
    <Screen titleJa={`${topic.emoji} ${topic.titleJa}`} back>
      <Conversation
        mode="freetalk"
        // Free talk adapts to whatever the learner produces, so the mid level
        // gives the tutor the widest range to meet them at.
        level="intermediate"
        topic={topic.topic}
        starters={[...topic.starters]}
        maxTurns={12}
        onFinish={setFinished}
      />
    </Screen>
  );
}
