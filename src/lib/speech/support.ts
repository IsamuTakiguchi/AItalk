/**
 * Minimal Web Speech typings. `@types/dom-speech-recognition` would also do, but
 * only these members are used and keeping them local avoids a global type that
 * would also leak into the server build.
 */
export type SpeechRecognitionAlternative = { transcript: string; confidence: number };
export type SpeechRecognitionResult = {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
};
export type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { readonly length: number; [index: number]: SpeechRecognitionResult };
};
export type SpeechRecognitionErrorEventLike = { error: string };

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  // The unprefixed name does not exist in Safari; Firefox has neither.
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const sttSupported = (): boolean => getRecognitionCtor() !== null;

export const ttsSupported = (): boolean =>
  typeof window !== "undefined" && "speechSynthesis" in window;

/** Web Speech needs a secure context; localhost counts, a bare LAN IP does not. */
export const isSecure = (): boolean =>
  typeof window === "undefined" || window.isSecureContext;

export const isIOS = (): boolean =>
  typeof navigator !== "undefined"
  && (/iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export type SpeechSupport = {
  stt: boolean;
  tts: boolean;
  secure: boolean;
  /** False when the learner must use the text fallback instead of the mic. */
  canSpeak: boolean;
  reasonJa?: string;
};

export function probeSpeechSupport(): SpeechSupport {
  const stt = sttSupported();
  const tts = ttsSupported();
  const secure = isSecure();
  const canSpeak = stt && secure;

  let reasonJa: string | undefined;
  if (!secure) {
    reasonJa = "音声認識には HTTPS（または localhost）が必要です。テキスト入力で練習できます。";
  } else if (!stt) {
    reasonJa =
      "このブラウザは音声認識に対応していません。Chrome、Edge、Safari をお使いください。"
      + "このままテキスト入力で練習することもできます。";
  }

  return { stt, tts, secure, canSpeak, reasonJa };
}
