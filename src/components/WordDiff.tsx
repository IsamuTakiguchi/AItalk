import type { ScoredWord } from "../lib/scoring";

const STYLE: Record<ScoredWord["status"], string> = {
  correct: "bg-good/10 text-good",
  near: "bg-near/10 text-near",
  missing: "bg-bad/10 text-bad line-through decoration-bad/40",
  extra: "bg-ink-400/15 text-ink-500 italic",
};

const LEGEND: [ScoredWord["status"], string][] = [
  ["correct", "聞き取れた"],
  ["near", "おしい"],
  ["missing", "聞き取れなかった"],
  ["extra", "余分に聞こえた"],
];

export function WordDiff({ words }: { words: ScoredWord[] }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {words.map((w, i) => (
          <span
            key={`${w.text}-${i}`}
            className={`rounded-md px-2 py-1 text-sm font-medium ${STYLE[w.status]}`}
            title={w.spoken ? `「${w.spoken}」と聞き取られました` : undefined}
          >
            {w.text}
            {w.spoken && w.status === "near" && (
              <span className="ml-1 text-[11px] opacity-70">→{w.spoken}</span>
            )}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {LEGEND.map(([status, label]) => (
          <span key={status} className="flex items-center gap-1 text-[11px] text-ink-500">
            <span className={`h-2.5 w-2.5 rounded-sm ${STYLE[status].split(" ")[0]}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
