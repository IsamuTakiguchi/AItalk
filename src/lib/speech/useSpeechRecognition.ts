import { useCallback, useEffect, useRef, useState } from "react";
import {
  getRecognitionCtor,
  type SpeechRecognitionLike,
} from "./support";

export type MicPermission = "unknown" | "granted" | "denied";

export type RecognitionState = {
  isSupported: boolean;
  isListening: boolean;
  /** Live partial text while the learner is still speaking. */
  interim: string;
  /** Finalised transcript for the current utterance. */
  final: string;
  permission: MicPermission;
  errorJa: string | null;
};

/** Stop this long after the last change in partial text. */
const SILENCE_MS = 2500;
/** Absolute ceiling on one utterance. */
const HARD_CAP_MS = 30_000;

export type UseSpeechRecognition = RecognitionState & {
  start: () => void;
  stop: () => void;
  reset: () => void;
};

export function useSpeechRecognition(
  onFinal?: (transcript: string) => void,
): UseSpeechRecognition {
  const [isListening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [final, setFinal] = useState("");
  const [permission, setPermission] = useState<MicPermission>("unknown");
  const [errorJa, setError] = useState<string | null>(null);

  const isSupported = getRecognitionCtor() !== null;

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const runningRef = useRef(false);
  const finalRef = useRef("");
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrored so the recogniser's handlers never close over a stale callback.
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const clearTimers = useCallback(() => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    if (capTimer.current) clearTimeout(capTimer.current);
    silenceTimer.current = null;
    capTimer.current = null;
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    // stop() finalises pending results; abort() would discard them.
    try {
      recRef.current?.stop();
    } catch { /* already stopped */ }
  }, [clearTimers]);

  const reset = useCallback(() => {
    finalRef.current = "";
    setFinal("");
    setInterim("");
    setError(null);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || runningRef.current) return;

    // Safari must not be handed a reused instance — stale internal state makes
    // the second session fail silently. A fresh one per utterance is reliable.
    const rec = new Ctor();
    recRef.current = rec;
    rec.lang = "en-US";
    // continuous:true never auto-stops on iOS, so each utterance is its own session.
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    finalRef.current = "";
    setFinal("");
    setInterim("");
    setError(null);

    const armSilence = () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      // Chrome's own end-of-speech detection is inconsistent, so we run our own.
      silenceTimer.current = setTimeout(() => stop(), SILENCE_MS);
    };

    rec.onstart = () => {
      runningRef.current = true;
      setListening(true);
      setPermission("granted");
      armSilence();
      capTimer.current = setTimeout(() => stop(), HARD_CAP_MS);
    };

    rec.onresult = (event) => {
      // results is cumulative across the session: only final segments are kept.
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalRef.current = `${finalRef.current} ${text}`.trim();
        else pending += text;
      }
      setInterim(pending);
      setFinal(finalRef.current);
      armSilence();
    };

    rec.onerror = (event) => {
      switch (event.error) {
        case "not-allowed":
        case "service-not-allowed":
          setPermission("denied");
          setError("マイクの使用が許可されていません。ブラウザの設定で許可するか、テキスト入力をお使いください。");
          break;
        case "no-speech":
          // Not a failure — the learner just didn't say anything yet.
          setError("音声が聞き取れませんでした。もう一度お試しください。");
          break;
        case "aborted":
          break;
        case "network":
          setError("音声認識サーバーに接続できませんでした。テキスト入力をお使いください。");
          break;
        default:
          setError("音声認識でエラーが発生しました。もう一度お試しください。");
      }
    };

    // onend fires on natural completion too, so it is the single place listening
    // state is cleared — otherwise the mic button latches on.
    rec.onend = () => {
      clearTimers();
      runningRef.current = false;
      setListening(false);
      setInterim("");
      const text = finalRef.current.trim();
      if (text) onFinalRef.current?.(text);
    };

    try {
      // Must be in the same tick as the user gesture on iOS — no await above this.
      rec.start();
    } catch {
      runningRef.current = false;
      setListening(false);
      setError("音声認識を開始できませんでした。もう一度お試しください。");
    }
  }, [clearTimers, stop]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") {
        try {
          recRef.current?.abort();
        } catch { /* nothing to abort */ }
      }
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      clearTimers();
      try {
        recRef.current?.abort();
      } catch { /* nothing to abort */ }
    };
  }, [clearTimers]);

  return { isSupported, isListening, interim, final, permission, errorJa, start, stop, reset };
}
