type Props = {
  listening: boolean;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
  labelJa?: string;
};

export function MicButton({ listening, disabled, onStart, onStop, labelJa }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        // No await anywhere in this handler: iOS requires start() in the same
        // tick as the gesture or recognition silently never begins.
        onClick={listening ? onStop : onStart}
        disabled={disabled}
        aria-label={listening ? "録音を止める" : "話す"}
        className={`relative flex h-20 w-20 items-center justify-center rounded-full shadow-lg transition
          active:scale-95 disabled:cursor-not-allowed disabled:bg-ink-400 disabled:shadow-none
          ${listening ? "mic-pulse bg-bad" : "bg-brand-600 hover:bg-brand-700"}`}
      >
        <span className="relative z-10 text-3xl">{listening ? "■" : "🎤"}</span>
      </button>
      <span className="text-xs font-medium text-ink-500">
        {labelJa ?? (listening ? "タップで停止" : "タップして話す")}
      </span>
    </div>
  );
}
