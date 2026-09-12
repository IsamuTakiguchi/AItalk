import { Link } from "react-router-dom";
import type { Lesson } from "../content/types";
import type { LessonRecord } from "../lib/progress";

const KIND_META: Record<Lesson["kind"], { icon: string; label: string }> = {
  phrase: { icon: "🗣", label: "フレーズ練習" },
  roleplay: { icon: "🎭", label: "ロールプレイ" },
  freetalk: { icon: "💬", label: "フリートーク" },
};

export function LessonCard({ lesson, record }: { lesson: Lesson; record?: LessonRecord }) {
  const meta = KIND_META[lesson.kind];
  const done = Boolean(record);

  return (
    <Link
      to={`/lesson/${lesson.id}`}
      className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm transition active:scale-[0.99]"
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${
          done ? "bg-good/10" : "bg-brand-50"
        }`}
      >
        {done ? "✓" : meta.icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{lesson.titleJa}</p>
        <p className="truncate text-[11px] text-ink-500">
          {meta.label}・約{lesson.estMinutes}分・{lesson.xp} XP
          {record?.bestScore != null && `・最高 ${record.bestScore}点`}
        </p>
      </div>
      <span className="text-ink-400">›</span>
    </Link>
  );
}
