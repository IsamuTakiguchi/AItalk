import { goalMet, xpToday, type Progress } from "../lib/progress";

export function StreakHeader({ progress }: { progress: Progress }) {
  const today = xpToday(progress);
  const goal = progress.settings.dailyGoalXp;
  const pct = Math.min(100, Math.round((today / goal) * 100));
  const met = goalMet(progress);

  return (
    <div className="flex items-center gap-4 rounded-2xl glass p-4">
      <div className="relative h-16 w-16 shrink-0">
        <svg width={64} height={64} className="-rotate-90">
          <circle cx={32} cy={32} r={27} fill="none" stroke="#e2e8f0" strokeWidth={6} />
          <circle
            cx={32}
            cy={32}
            r={27}
            fill="none"
            stroke={met ? "var(--color-good)" : "var(--color-brand-500)"}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 27}
            strokeDashoffset={2 * Math.PI * 27 * (1 - pct / 100)}
            style={{ transition: "stroke-dashoffset 600ms ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-lg">
          {met ? "✅" : "🎯"}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tabular-nums">{progress.streak.current}</span>
          <span className="text-sm text-ink-500">日連続 🔥</span>
        </div>
        <p className="mt-0.5 text-xs text-ink-500">
          今日 <span className="font-semibold tabular-nums text-ink-800">{today}</span> / {goal} XP
          {met && <span className="ml-1 font-semibold text-good">目標達成！</span>}
        </p>
        <p className="text-[11px] text-ink-400">
          累計 {progress.xp.total} XP・最長 {progress.streak.longest} 日
        </p>
      </div>
    </div>
  );
}
