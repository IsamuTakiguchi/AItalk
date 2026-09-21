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

/**
 * How long to wait for the learner to start speaking.
 *
 * This is deliberately generous and deliberately separate from SILENCE_MS. The
 * two are different questions: "has this person begun?" and "have they
 * finished?". Sharing one short timer between them is what used to cut the
 * microphone off after two and a half seconds — long before someone reading an
 * unfamiliar English sentence had got a word out, and with an empty transcript,
 * so nothing was scored and nothing was shown either.
 */
const LEAD_IN_MS = 10_000;
/** Silence that ends an utterance — armed only once speech has been heard. */
const SILENCE_MS = 2_000;
/** Absolute ceiling on one utterance. */
const HARD_CAP_MS = 30_000;
/**
 * How long `stop()` gets before we stop believing the recogniser. WebKit can
 * drop a session without firing onresult, onerror or onend, which would leave
 * the button latched on "tap to stop" forever.
 */
const END_WATCHDOG_MS = 1_500;

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
  const leadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The microphone actually opened, or something was heard through it. */
  const aliveRef = useRef(false);
  const sawErrorRef = useRef(false);
  /** Guards the one-time teardown, which onend and the watchdog both race for. */
  const settledRef = useRef(true);
  // Mirrored so the recogniser's handlers never close over a stale callback.
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const clearTimers = useCallback(() => {
    for (const t of [leadTimer, silenceTimer, capTimer, endTimer]) {
      if (t.current) clearTimeout(t.current);
      t.current = null;
    }
  }, []);

  /**
   * Runs exactly once per session, whichever of onend or the watchdog gets here
   * first. Everything that must be true when the microphone is closed lives
   * here, so no path can leave the button latched or the learner with no word
   * about what happened.
   */
  const settle = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    clearTimers();
    runningRef.current = false;
    setListening(false);
    setInterim("");

    const text = finalRef.current.trim();
    if (text) {
      onFinalRef.current?.(text);
      return;
    }
    // Nothing was captured. Say so rather than just springing back to "tap to
    // speak", which reads as the app breaking for no reason.
    if (!sawErrorRef.current) {
      setError(
        aliveRef.current
          ? "音声が聞き取れませんでした。もう一度お試しください。"
          : "このブラウザでは音声入力が動いていないようです。キーボード入力をお使いください。",
      );
    }
  }, [clearTimers]);

  /** Closes the recogniser and makes sure we settle even if it never answers. */
  const endSession = useCallback(() => {
    if (leadTimer.current) clearTimeout(leadTimer.current);
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    if (capTimer.current) clearTimeout(capTimer.current);
    leadTimer.current = silenceTimer.current = capTimer.current = null;

    // stop() finalises pending results; abort() would discard them.
    try {
      recRef.current?.stop();
    } catch { /* already stopped */ }

    if (endTimer.current) clearTimeout(endTimer.current);
    endTimer.current = setTimeout(() => {
      try {
        recRef.current?.abort();
      } catch { /* nothing to abort */ }
      settle();
    }, END_WATCHDOG_MS);
  }, [settle]);

  const stop = useCallback(() => {
    endSession();
  }, [endSession]);

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
    aliveRef.current = false;
    sawErrorRef.current = false;
    settledRef.current = false;
    setFinal("");
    setInterim("");
    setError(null);

    /** Start counting down to the end of the utterance. */
    const armSilence = () => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => endSession(), SILENCE_MS);
    };

    /**
     * Speech is happening right now, so the lead-in is over and nothing should
     * be counting down: it is onspeechend/onsoundend, or a gap between results,
     * that starts the clock again.
     */
    const heardSpeech = () => {
      aliveRef.current = true;
      if (leadTimer.current) clearTimeout(leadTimer.current);
      leadTimer.current = null;
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    };

    rec.onstart = () => {
      runningRef.current = true;
      setListening(true);
      setPermission("granted");
      // Only the lead-in and the hard cap run until we have heard something.
      leadTimer.current = setTimeout(() => endSession(), LEAD_IN_MS);
      capTimer.current = setTimeout(() => endSession(), HARD_CAP_MS);
    };

    // The mic opened. Not a speech signal, but it does prove the engine is real
    // — which is how a browser that cannot do speech at all gets told apart
    // from a learner who simply stayed quiet.
    rec.onaudiostart = () => { aliveRef.current = true; };

    rec.onsoundstart = heardSpeech;
    rec.onspeechstart = heardSpeech;
    // WebKit's interim results are unreliable, so the end-of-speech events —
    // not the arrival of transcripts — are what we lean on to start counting.
    rec.onspeechend = armSilence;
    rec.onsoundend = armSilence;

    rec.onresult = (event) => {
      heardSpeech();
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
      // A pause long enough to outlast this is the end of the utterance.
      armSilence();
    };

    rec.onerror = (event) => {
      switch (event.error) {
        case "not-allowed":
        case "service-not-allowed":
          sawErrorRef.current = true;
          setPermission("denied");
          setError("マイクの使用が許可されていません。ブラウザの設定で許可するか、テキスト入力をお使いください。");
          break;
        case "no-speech":
          sawErrorRef.current = true;
          // Not a failure — the learner just didn't say anything yet.
          setError("音声が聞き取れませんでした。もう一度お試しください。");
          break;
        case "aborted":
          break;
        case "network":
          sawErrorRef.current = true;
          setError("音声認識サーバーに接続できませんでした。テキスト入力をお使いください。");
          break;
        default:
          sawErrorRef.current = true;
          setError("音声認識でエラーが発生しました。もう一度お試しください。");
      }
    };

    // onend fires on natural completion too, so listening state is cleared in
    // settle() rather than here — the watchdog needs the same teardown.
    rec.onend = settle;

    try {
      // Must be in the same tick as the user gesture on iOS — no await above this.
      rec.start();
    } catch {
      settledRef.current = true;
      runningRef.current = false;
      setListening(false);
      setError("音声認識を開始できませんでした。もう一度お試しください。");
    }
  }, [endSession, settle]);

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
      // Nothing may settle after unmount: abort() below fires onend.
      settledRef.current = true;
      try {
        recRef.current?.abort();
      } catch { /* nothing to abort */ }
    };
  }, [clearTimers]);

  return { isSupported, isListening, interim, final, permission, errorJa, start, stop, reset };
}
