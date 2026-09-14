import type { UnitVideo } from "../server/youtube";

export type { UnitVideo };

/**
 * Asks the server for a unit's supporting video.
 *
 * Returns null for every failure rather than throwing: the video is an optional
 * extra on top of the lecture slides, and a search that finds nothing is the
 * normal case, not an error worth surfacing.
 */
export async function fetchUnitVideo(
  unitId: string,
  query: string | undefined,
): Promise<UnitVideo | null> {
  if (!query) return null;
  try {
    const res = await fetch(`/api/lecture/${encodeURIComponent(unitId)}/video?q=${encodeURIComponent(query)}`);
    if (!res.ok) return null;
    return ((await res.json()) as { video: UnitVideo | null }).video;
  } catch {
    return null;
  }
}
