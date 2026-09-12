import { useEffect, useState } from "react";
import { fetchHealth } from "./api";

/** Whether a real API key is configured, so the UI can flag mock mode once. */
export function useAiEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchHealth().then((h) => {
      if (alive) setEnabled(h.aiEnabled);
    });
    return () => {
      alive = false;
    };
  }, []);
  return enabled;
}
