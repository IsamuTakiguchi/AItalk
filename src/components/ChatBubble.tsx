type Props = {
  role: "tutor" | "user";
  en: string;
  ja?: string;
  showJa: boolean;
  onSpeak?: () => void;
  speaking?: boolean;
};

export function ChatBubble({ role, en, ja, showJa, onSpeak, speaking }: Props) {
  const isTutor = role === "tutor";
  return (
    <div className={`flex ${isTutor ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
          isTutor ? "bg-white text-ink-900" : "bg-brand-600 text-white"
        }`}
      >
        <p className="text-[15px] leading-relaxed">{en}</p>
        {showJa && ja && (
          <p className={`mt-1.5 text-xs leading-relaxed ${isTutor ? "text-ink-500" : "text-brand-100"}`}>
            {ja}
          </p>
        )}
        {isTutor && onSpeak && (
          <button
            type="button"
            onClick={onSpeak}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-600 active:opacity-60"
          >
            {speaking ? "🔊 再生中…" : "🔈 もう一度聞く"}
          </button>
        )}
      </div>
    </div>
  );
}

export function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-2xl glass px-4 py-4">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-ink-400"
            style={{ animation: `dot-bounce 1.2s ${i * 0.15}s infinite ease-in-out` }}
          />
        ))}
      </div>
    </div>
  );
}
