import { toSyncPayload } from "./mergeProgress";
import type { Progress } from "./progress";

/** Server-side progress storage. All calls rely on the session cookie. */
export async function fetchServerProgress(): Promise<Progress | null> {
  const res = await fetch("/api/progress");
  if (!res.ok) return null;
  const { progress } = (await res.json()) as { progress: Progress | null };
  return progress;
}

/**
 * Saves a snapshot.
 *
 * The default `merge` mode is why this is safe to call often and to retry: the
 * server takes the maximum of every counter, so a duplicate or out-of-order save
 * cannot inflate or lose anything. `replace` is only for clearing and importing.
 */
export async function saveServerProgress(
  p: Progress,
  mode: "merge" | "replace" = "merge",
): Promise<Progress | null> {
  const res = await fetch(`/api/progress${mode === "replace" ? "?mode=replace" : ""}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(toSyncPayload(p)),
  });
  if (!res.ok) return null;
  const { progress } = (await res.json()) as { progress: Progress | null };
  return progress;
}
