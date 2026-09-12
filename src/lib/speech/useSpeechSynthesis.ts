import { useCallback, useEffect, useRef, useState } from "react";
import { isIOS, ttsSupported } from "./support";

/**
 * Voice list resolution is cached module-wide: `getVoices()` returns `[]` on the
 * first call in Chrome, and some browsers never fire `voiceschanged`, so it needs
 * both an event listener and a poll.
 */
let cachedVoices: SpeechSynthesisVoice[] | null = null;
let pending: Promise<SpeechSynthesisVoice[]> | null = null;

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (cachedVoices) return Promise.resolve(cachedVoices);
  if (pending) return pending;
  if (!ttsSupported()) return Promise.resolve([]);

  pending = new Promise((resolve) => {
    const settle = (voices: SpeechSynthesisVoice[]) => {
      cachedVoices = voices;
      window.speechSynthesis.removeEventListener("voiceschanged", onChange);
      clearInterval(poll);
      resolve(voices);
    };
    const onChange = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) settle(v);
    };

    const immediate = window.speechSynthesis.getVoices();
    if (immediate.length) {
      cachedVoices = immediate;
      resolve(immediate);
      return;
    }

    window.speechSynthesis.addEventListener("voiceschanged", onChange);
    let waited = 0;
    const poll = setInterval(() => {
      const v = window.speechSynthesis.getVoices();
      waited += 200;
      // Give up after 2s and accept an empty list — the default voice still works.
      if (v.length || waited >= 2000) settle(v);
    }, 200);
  });

  return pending;
}

function pickVoice(voices: SpeechSynthesisVoice[], preferredUri: string | null): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  if (preferredUri) {
    // Voice lists differ per device, so a stored choice always gets revalidated.
    const saved = voices.find((v) => v.voiceURI === preferredUri);
    if (saved) return saved;
  }
  const english = voices.filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith("en"));
  if (!english.length) return null;

  const byName = ["Samantha", "Google US English", "Microsoft Aria"];
  for (const name of byName) {
    const hit = english.find((v) => v.name.includes(name));
    if (hit) return hit;
  }
  const us = english.filter((v) => v.lang.replace("_", "-").toLowerCase() === "en-us");
  const pool = us.length ? us : english;
  // Local voices start faster and work offline.
  return pool.find((v) => v.localService) ?? pool[0]!;
}

/** Chrome truncates utterances beyond roughly 15 seconds, so long text is chunked. */
function chunk(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const out: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + s).length > 180 && buf) {
      out.push(buf.trim());
      buf = s;
    } else {
      buf += s;
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

export type UseSpeechSynthesis = {
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
  voice: SpeechSynthesisVoice | null;
  isSpeaking: boolean;
  needsUnlock: boolean;
  speak: (text: string, opts?: { rate?: number }) => Promise<void>;
  cancel: () => void;
  unlock: () => void;
};

export function useSpeechSynthesis(
  preferredUri: string | null,
  defaultRate = 0.9,
): UseSpeechSynthesis {
  const isSupported = ttsSupported();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setSpeaking] = useState(false);
  const [needsUnlock, setNeedsUnlock] = useState(isSupported && isIOS());

  /**
   * Utterances are held in a ref for the whole time they are speaking. If they are
   * garbage-collected mid-speech — a long-standing Chrome/Safari bug — `onend`
   * never fires and `isSpeaking` latches on forever.
   */
  const liveUtterances = useRef<SpeechSynthesisUtterance[]>([]);

  useEffect(() => {
    let alive = true;
    void loadVoices().then((v) => {
      if (alive) setVoices(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  const voice = pickVoice(voices, preferredUri);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const cancel = useCallback(() => {
    if (!isSupported) return;
    try {
      window.speechSynthesis.cancel();
    } catch { /* nothing queued */ }
    liveUtterances.current = [];
    setSpeaking(false);
  }, [isSupported]);

  /** iOS stays silent unless the first utterance happens inside a user gesture. */
  const unlock = useCallback(() => {
    if (!isSupported || !needsUnlock) return;
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
      setNeedsUnlock(false);
    } catch { /* best effort */ }
  }, [isSupported, needsUnlock]);

  const speak = useCallback(
    (text: string, opts?: { rate?: number }) =>
      new Promise<void>((resolve) => {
        if (!isSupported || !text.trim()) {
          resolve();
          return;
        }
        // The browser's own speaking/pending flags are unreliable; always reset.
        window.speechSynthesis.cancel();

        const parts = chunk(text);
        const utterances = parts.map((part) => {
          const u = new SpeechSynthesisUtterance(part);
          u.lang = "en-US";
          u.rate = opts?.rate ?? defaultRate;
          u.pitch = 1;
          if (voiceRef.current) u.voice = voiceRef.current;
          return u;
        });

        liveUtterances.current = utterances;
        let remaining = utterances.length;
        const done = () => {
          remaining -= 1;
          if (remaining <= 0) {
            liveUtterances.current = [];
            setSpeaking(false);
            resolve();
          }
        };
        for (const u of utterances) {
          u.onend = done;
          u.onerror = done;
        }

        setSpeaking(true);
        for (const u of utterances) window.speechSynthesis.speak(u);
      }),
    [defaultRate, isSupported],
  );

  useEffect(() => () => {
    if (ttsSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch { /* nothing queued */ }
    }
  }, []);

  return { isSupported, voices, voice, isSpeaking, needsUnlock, speak, cancel, unlock };
}
