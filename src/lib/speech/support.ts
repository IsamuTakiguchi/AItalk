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
  /** The microphone opened. Says nothing about whether anyone spoke. */
  onaudiostart: (() => void) | null;
  /** Any sound at all, speech or not. WebKit is more reliable here than onspeechstart. */
  onsoundstart: (() => void) | null;
  /** The engine decided the sound is speech. Not fired at all by some WebKit builds. */
  onspeechstart: (() => void) | null;
  /** Speech stopped. This, not a timer, is the honest cue to start counting silence. */
  onspeechend: (() => void) | null;
  onsoundend: (() => void) | null;
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

/** Browsers that put their own name in the UA while running on WKWebView. */
const IOS_REBADGED = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo/;

/**
 * True when this is iOS but not Safari itself.
 *
 * iOS forces every browser onto WebKit, and Apple has never enabled the Web
 * Speech API in WKWebView — only Safari.app can use it. The catch is that
 * `webkitSpeechRecognition` is still *defined* in Chrome, Edge and Firefox for
 * iOS and in every in-app browser, and `start()` even resolves into `onstart`.
 * Feature detection therefore reports success and the microphone appears to
 * open; audio simply never arrives. Without this check the learner is handed a
 * mic that cannot work and no explanation of why.
 *
 * Deliberately limited to cases that are certainly WebKit-in-disguise: a
 * rebadged browser names itself, and a bare in-app WKWebView carries no
 * `Safari/` token at all. Anything ambiguous is left alone — wrongly blocking a
 * browser where speech does work is the worse failure, and the hook reports a
 * dead session at runtime to cover what the UA cannot tell us.
 */
export function isIOSWebView(): boolean {
  if (!isIOS() || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return IOS_REBADGED.test(ua) || !/Safari\//.test(ua);
}

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
  const iosWebView = isIOSWebView();
  const canSpeak = stt && secure && !iosWebView;

  let reasonJa: string | undefined;
  if (!secure) {
    reasonJa = "音声認識には HTTPS（または localhost）が必要です。テキスト入力で練習できます。";
  } else if (iosWebView) {
    reasonJa =
      "iPhone・iPad で音声入力に対応しているのは Safari だけです"
      + "（Apple の制限によるもので、Chrome など他のブラウザやアプリ内ブラウザでは動きません）。"
      + "Safari でこのページを開き直すと音声で練習できます。"
      + "このままテキスト入力で進めることもできます。";
  } else if (!stt) {
    reasonJa =
      "このブラウザは音声認識に対応していません。Chrome、Edge、Safari をお使いください。"
      + "このままテキスト入力で練習することもできます。";
  }

  return { stt, tts, secure, canSpeak, reasonJa };
}
