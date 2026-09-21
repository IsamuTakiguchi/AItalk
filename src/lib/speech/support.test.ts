/**
 * Guards the one decision that decides whether a learner is shown a microphone
 * at all.
 *
 * iOS forces every browser onto WebKit, and Apple has not enabled the Web
 * Speech API in WKWebView. `webkitSpeechRecognition` is nonetheless defined in
 * Chrome, Edge and Firefox for iOS, and start() even reaches onstart — so plain
 * feature detection says "supported" and then no audio ever arrives. That is
 * exactly the bug this table exists to prevent coming back.
 *
 * No browser: window and navigator are stubbed, so this runs under plain node.
 */
import { probeSpeechSupport } from "./support";

let fails = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
  if (!ok) fails++;
};

type Env = { ua: string; platform?: string; touchPoints?: number; ctor?: boolean; secure?: boolean };

// node 22 defines `navigator` itself, as a getter-only accessor, so it has to
// be redefined rather than assigned.
const setGlobal = (name: string, value: unknown) =>
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

/** Rebuilds the two globals probeSpeechSupport reads, then probes. */
function probe({ ua, platform = "iPhone", touchPoints = 5, ctor = true, secure = true }: Env) {
  setGlobal("navigator", { userAgent: ua, platform, maxTouchPoints: touchPoints });
  setGlobal("window", {
    isSecureContext: secure,
    speechSynthesis: {},
    ...(ctor ? { webkitSpeechRecognition: class {} } : {}),
  });
  return probeSpeechSupport();
}

// Real user-agent strings, not hand-written approximations: the check is a
// substring match, so a paraphrase would test nothing.
const IOS_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IOS_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1";
const IOS_FIREFOX =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15";
const IOS_EDGE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/126.0.2592.87 Mobile/15E148 Safari/605.1.15";
const IOS_INAPP =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/14.10.0";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// --- iOS: Safari only -------------------------------------------------------
check("iOS Safari can use the mic", probe({ ua: IOS_SAFARI }).canSpeak === true);
check("iOS Chrome cannot", probe({ ua: IOS_CHROME }).canSpeak === false);
check("iOS Firefox cannot", probe({ ua: IOS_FIREFOX }).canSpeak === false);
check("iOS Edge cannot", probe({ ua: IOS_EDGE }).canSpeak === false);
check("an in-app WKWebView cannot", probe({ ua: IOS_INAPP }).canSpeak === false);

// The constructor being present is exactly the trap: these browsers all pass
// feature detection, which is why canSpeak must not be derived from it alone.
check(
  "iOS Chrome still reports the constructor",
  probe({ ua: IOS_CHROME }).stt === true,
);
check(
  "iOS Chrome is told it needs Safari",
  (probe({ ua: IOS_CHROME }).reasonJa ?? "").includes("Safari"),
);

// --- everywhere else --------------------------------------------------------
check("Android Chrome can use the mic", probe({ ua: ANDROID_CHROME, platform: "Linux armv8l", touchPoints: 5 }).canSpeak === true);
check("desktop Chrome can use the mic", probe({ ua: DESKTOP_CHROME, platform: "Win32", touchPoints: 0 }).canSpeak === true);
check("macOS Safari can use the mic", probe({ ua: MAC_SAFARI, platform: "MacIntel", touchPoints: 0 }).canSpeak === true);

// An iPad reports itself as MacIntel with touch points, which is why isIOS()
// checks that as well as the phone strings.
check(
  "an iPad pretending to be a Mac is still iOS",
  probe({ ua: MAC_SAFARI.replace("Safari/605.1.15", "CriOS/126.0 Safari/605.1.15"), platform: "MacIntel", touchPoints: 5 }).canSpeak === false,
);

// --- unrelated reasons the mic is unavailable -------------------------------
check("no constructor means no mic", probe({ ua: DESKTOP_CHROME, platform: "Win32", touchPoints: 0, ctor: false }).canSpeak === false);
check("an insecure context means no mic", probe({ ua: DESKTOP_CHROME, platform: "Win32", touchPoints: 0, secure: false }).canSpeak === false);
check(
  "the insecure-context reason wins over everything",
  (probe({ ua: IOS_CHROME, secure: false }).reasonJa ?? "").includes("HTTPS"),
);
check(
  "every unavailable case explains itself",
  [
    probe({ ua: IOS_CHROME }),
    probe({ ua: IOS_INAPP }),
    probe({ ua: DESKTOP_CHROME, platform: "Win32", touchPoints: 0, ctor: false }),
    probe({ ua: DESKTOP_CHROME, platform: "Win32", touchPoints: 0, secure: false }),
  ].every((s) => !s.canSpeak && Boolean(s.reasonJa)),
);

console.log(fails ? `\n${fails} speech-support check(s) failed` : "\nall speech-support checks pass");
process.exit(fails ? 1 : 0);
