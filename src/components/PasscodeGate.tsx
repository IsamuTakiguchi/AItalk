import { useState } from "react";
import { verifyPasscode } from "../lib/api";
import { setPasscode } from "../lib/passcode";

/**
 * Shown when the deployment sets DEMO_PASSCODE and this browser has no valid
 * code stored. The code is validated against the server before the app unlocks,
 * so a wrong code fails here rather than in the middle of a conversation.
 */
export function PasscodeGate({ onUnlocked }: { onUnlocked: () => void }) {
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [invalid, setInvalid] = useState(false);

  const submit = async () => {
    const trimmed = code.trim();
    if (!trimmed || checking) return;
    setChecking(true);
    setInvalid(false);

    if (await verifyPasscode(trimmed)) {
      setPasscode(trimmed);
      onUnlocked();
    } else {
      setInvalid(true);
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col justify-center px-6 py-10">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-center text-4xl">🔒</p>
        <h1 className="mt-3 text-center text-lg font-bold">アクセスコードを入力</h1>
        <p className="mt-2 text-center text-xs leading-relaxed text-ink-500">
          このデプロイはアクセスコードで保護されています。
          管理者から共有されたコードを入力してください。
        </p>

        {invalid && (
          <p className="mt-3 rounded-lg bg-bad/5 px-3 py-2 text-center text-xs text-bad">
            コードが正しくありません。もう一度お試しください。
          </p>
        )}

        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          type="password"
          autoComplete="off"
          placeholder="アクセスコード"
          disabled={checking}
          className="mt-4 w-full rounded-xl border border-ink-400/25 px-3 py-3 text-sm outline-none focus:border-brand-500 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!code.trim() || checking}
          className="mt-3 w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white active:scale-[0.98] disabled:bg-ink-400"
        >
          {checking ? "確認中…" : "はじめる"}
        </button>
      </div>
    </div>
  );
}
