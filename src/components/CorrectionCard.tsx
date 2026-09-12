import type { Correction } from "../server/schemas";

const KIND_LABEL: Record<Correction["kind"], string> = {
  grammar: "文法",
  vocabulary: "語彙",
  naturalness: "自然さ",
};

export function CorrectionCard({ c }: { c: Correction }) {
  return (
    <div className="rounded-xl border border-near/25 bg-near/5 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-near/15 px-1.5 py-0.5 text-[10px] font-bold text-near">
          {KIND_LABEL[c.kind]}
        </span>
        <span className="text-[11px] font-medium text-ink-500">添削</span>
      </div>
      <p className="text-sm text-ink-500 line-through decoration-bad/50">{c.original}</p>
      <p className="mt-0.5 text-sm font-semibold text-good">{c.corrected}</p>
      <p className="mt-2 text-xs leading-relaxed text-ink-600">{c.reasonJa}</p>
    </div>
  );
}
