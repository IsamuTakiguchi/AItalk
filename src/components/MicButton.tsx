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
      <div className="relative">
        {/*
         * Two rings expanding on a stagger, so the pulse reads as continuous
         * rather than as one ring restarting. Purely decorative and outside the
         * button, so it cannot interfere with the tap target.
         */}
        {listening && (
          <>
            <span aria-hidden className="mic-pulse absolute inset-0 rounded-full" />
            <span
              aria-hidden
              className="mic-pulse absolute inset-0 rounded-full"
              style={{ animationDelay: "0.85s" }}
            />
          </>
        )}

        <button
          type="button"
          // No await anywhere in this handler: iOS requires start() in the same
          // tick as the gesture or recognition silently never begins.
          onClick={listening ? onStop : onStart}
          disabled={disabled}
          aria-label={listening ? "録音を止める" : "話す"}
          className={`press relative flex h-20 w-20 items-center justify-center rounded-full
            disabled:cursor-not-allowed disabled:bg-ink-400 disabled:shadow-none
            ${listening ? "bg-bad" : "bg-brand-600"}`}
          style={{
            boxShadow: disabled
              ? "none"
              : listening
                ? "inset 0 1px 0 rgba(255,255,255,0.4), 0 10px 32px -8px rgba(220,38,38,0.65)"
                : "inset 0 1px 0 rgba(255,255,255,0.4), 0 10px 32px -8px rgba(79,70,229,0.7)",
          }}
        >
          {/* Specular sheen across the top, the way a lit glass dome catches light. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                "linear-gradient(to bottom, rgba(255,255,255,0.32), rgba(255,255,255,0) 55%)",
            }}
          />
          <span
            className="relative z-10 text-3xl"
            style={{
              transform: listening ? "scale(0.82)" : "scale(1)",
              transition: "transform 0.36s var(--ease-spring)",
            }}
          >
            {listening ? "■" : "🎤"}
          </span>
        </button>
      </div>
      <span className="text-xs font-medium text-ink-500">
        {labelJa ?? (listening ? "タップで停止" : "タップして話す")}
      </span>
    </div>
  );
}
