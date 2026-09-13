import { useCallback, useEffect, useState } from "react";
import type { SessionUser } from "../server/session";

export type SessionState =
  | { status: "loading" }
  | { status: "out" }
  | { status: "in"; user: SessionUser };

/**
 * Who is signed in. Login is required, so this drives the whole app: until it
 * resolves nothing is rendered, and `out` shows the login screen.
 */
export function useSession(): { session: SessionState; refresh: () => void; signOut: () => Promise<void> } {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    void fetch("/api/auth/me")
      .then(async (res) => {
        if (!alive) return;
        if (!res.ok) {
          setSession({ status: "out" });
          return;
        }
        const { user } = (await res.json()) as { user: SessionUser };
        setSession({ status: "in", user });
      })
      .catch(() => {
        // Offline: treat as signed out rather than hanging on the splash.
        if (alive) setSession({ status: "out" });
      });
    return () => {
      alive = false;
    };
  }, [nonce]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setSession({ status: "out" });
  }, []);

  return { session, refresh: useCallback(() => setNonce((n) => n + 1), []), signOut };
}
