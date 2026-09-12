import { useCallback, useEffect, useState } from "react";
import { fetchHealth } from "./api";
import type { HealthResponse } from "../server/schemas";

export function useHealth(): { health: HealthResponse | null; refresh: () => void } {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    void fetchHealth().then((h) => {
      if (alive) setHealth(h);
    });
    return () => {
      alive = false;
    };
  }, [nonce]);

  return { health, refresh: useCallback(() => setNonce((n) => n + 1), []) };
}

/** Whether a real API key is configured, so the UI can flag mock mode once. */
export function useAiEnabled(): boolean | null {
  const { health } = useHealth();
  return health ? health.aiEnabled : null;
}
