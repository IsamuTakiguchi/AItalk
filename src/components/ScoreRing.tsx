import { BAND_LABEL_JA, scoreBand } from "../lib/scoring";

type Props = { score: number; size?: number };

export function ScoreRing({ score, size = 96 }: Props) {
  const band = scoreBand(score);
  const color = band === "great" ? "var(--color-good)" : band === "good" ? "var(--color-near)" : "var(--color-bad)";
  const r = (size - 10) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={8} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - score / 100)}
            style={{
              // Starts empty and sweeps round, so the number lands with the arc.
              animation: "none",
              transition: "stroke-dashoffset 900ms var(--ease-glide)",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-2xl font-bold tabular-nums"
            style={{ animation: "rise-in 0.5s var(--ease-spring) both", animationDelay: "0.12s" }}
          >
            {score}
          </span>
        </div>
      </div>
      <span className="text-sm font-semibold" style={{ color }}>
        {BAND_LABEL_JA[band]}
      </span>
    </div>
  );
}

/**
 * Shown wherever a score is. The recogniser only ever returns text, so calling
 * this a pronunciation score would be a claim the data cannot support.
 */
export function ScoreDisclaimer() {
  return (
    <p className="rounded-lg bg-ink-800/5 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
      「認識スコア」は、ブラウザの音声認識があなたの発話をどれだけお手本どおりに聞き取れたかを表します。
      発音の正確さそのものを測るものではありません。レッスンの達成はスコアに左右されません。
    </p>
  );
}
