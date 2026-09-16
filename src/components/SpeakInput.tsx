import { useState } from "react";
import { MicButton } from "./MicButton";
import { UnsupportedBrowserNotice } from "./UnsupportedBrowserNotice";
import type { UseSpeechRecognition } from "../lib/speech/useSpeechRecognition";
import type { SpeechSupport } from "../lib/speech/support";

type Props = {
  stt: UseSpeechRecognition;
  support: SpeechSupport;
  busy?: boolean;
  /** Called when the learner submits text instead of speaking. */
  onSubmitText: (text: string) => void;
  /** Cancels any speech playback before the mic opens (required on iOS). */
  beforeStart?: () => void;
  placeholderJa?: string;
};

/**
 * Mic-first input with a text fallback that is always reachable — Firefox has no
 * SpeechRecognition at all, and a denied mic permission must not be a dead end.
 */
/**
 * Remembered for the rest of the page session. This component unmounts between
 * drill items, so without it a learner who switched to the keyboard would be
 * handed the microphone again on every single phrase.
 */
let preferTextMode = false;

export function SpeakInput({ stt, support, busy, onSubmitText, beforeStart, placeholderJa }: Props) {
  const [text, setText] = useState("");
  const [textMode, setTextModeState] = useState(preferTextMode || !support.canSpeak);

  const setTextMode = (on: boolean) => {
    preferTextMode = on;
    setTextModeState(on);
  };

  const micUnavailable = !support.canSpeak || stt.permission === "denied";
  const showText = textMode || micUnavailable;

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setText("");
    onSubmitText(trimmed);
  };

  return (
    <div className="space-y-3">
      {micUnavailable && support.reasonJa && <UnsupportedBrowserNotice reasonJa={support.reasonJa} />}
      {stt.permission === "denied" && support.canSpeak && stt.errorJa && (
        <UnsupportedBrowserNotice reasonJa={stt.errorJa} />
      )}

      {(stt.isListening || stt.interim) && (
        <div className="rounded-xl glass p-3">
          <p className="text-[11px] font-medium text-ink-400">聞き取り中…</p>
          <p className="mt-1 min-h-6 text-sm text-ink-800">
            {stt.interim || stt.final || <span className="text-ink-400">話してください</span>}
          </p>
        </div>
      )}

      {stt.errorJa && stt.permission !== "denied" && (
        <p className="text-center text-xs text-near">{stt.errorJa}</p>
      )}

      {showText ? (
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={placeholderJa ?? "英語で入力…"}
            disabled={busy}
            className="min-w-0 flex-1 rounded-xl border border-ink-400/25 bg-white px-3 py-3 text-sm outline-none focus:border-brand-500 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || !text.trim()}
            className="shrink-0 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white press disabled:bg-ink-400"
          >
            送信
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <MicButton
            listening={stt.isListening}
            disabled={busy}
            onStart={() => {
              // Synchronous: recognition cannot start while synthesis is active,
              // and on iOS start() must stay in the gesture's own tick.
              beforeStart?.();
              stt.start();
            }}
            onStop={stt.stop}
          />
          <button
            type="button"
            onClick={() => setTextMode(true)}
            className="text-[11px] font-medium text-ink-400 underline"
          >
            キーボードで入力する
          </button>
        </div>
      )}

      {showText && support.canSpeak && stt.permission !== "denied" && (
        <button
          type="button"
          onClick={() => setTextMode(false)}
          className="mx-auto block text-[11px] font-medium text-ink-400 underline"
        >
          マイクに戻す
        </button>
      )}
    </div>
  );
}
