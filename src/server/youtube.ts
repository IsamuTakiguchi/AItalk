import { ensureSchema, getSql } from "./db";
import type { AppConfig } from "./env";

/**
 * Finds a supporting YouTube video for a unit.
 *
 * Three constraints shape this:
 *
 * 1. The default YouTube Data API allowance is 100 `search.list` calls per day,
 *    so searching on each page view is not viable. Results are cached in the
 *    database per unit and reused indefinitely until explicitly refreshed.
 * 2. A video that cannot be embedded renders as an error inside the player, so
 *    candidates are filtered through `videos.list` and only embeddable,
 *    public ones are kept.
 * 3. What comes back is somebody else's video, not a lesson made for this app.
 *    The caller labels it as a reference, and the unit's own slides remain the
 *    actual teaching content.
 */
export type UnitVideo = {
  videoId: string;
  title: string;
  channel: string;
  /** ISO-8601 duration as returned by the API, e.g. "PT7M31S". */
  duration: string;
  thumbnail: string;
};

const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

/** Beyond this, a "quick explanation before the unit" stops being quick. */
const MAX_DURATION_SECONDS = 20 * 60;
const MIN_DURATION_SECONDS = 60;

type SearchItem = { id?: { videoId?: string } };
type VideoItem = {
  id: string;
  snippet: { title: string; channelTitle: string; thumbnails: Record<string, { url: string }> };
  contentDetails: { duration: string };
  status: { embeddable: boolean; privacyStatus: string };
};

/** "PT7M31S" -> 451. Returns 0 for anything unparseable. */
export function parseDuration(iso: string): number {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/**
 * Picks the best candidate.
 *
 * Deliberately simple and deterministic rather than asking Claude: the ranking
 * YouTube already applied is the strongest signal available, so this only drops
 * what is unusable and otherwise preserves that order.
 */
export function chooseVideo(candidates: VideoItem[]): UnitVideo | null {
  const usable = candidates.filter((v) => {
    if (!v.status?.embeddable || v.status.privacyStatus !== "public") return false;
    const seconds = parseDuration(v.contentDetails?.duration ?? "");
    return seconds >= MIN_DURATION_SECONDS && seconds <= MAX_DURATION_SECONDS;
  });
  const best = usable[0];
  if (!best) return null;
  return {
    videoId: best.id,
    title: best.snippet.title,
    channel: best.snippet.channelTitle,
    duration: best.contentDetails.duration,
    thumbnail:
      best.snippet.thumbnails?.medium?.url ?? best.snippet.thumbnails?.default?.url ?? "",
  };
}

async function searchYouTube(apiKey: string, query: string): Promise<UnitVideo | null> {
  const search = new URL(SEARCH_URL);
  search.searchParams.set("key", apiKey);
  search.searchParams.set("part", "snippet");
  search.searchParams.set("q", query);
  search.searchParams.set("type", "video");
  search.searchParams.set("maxResults", "10");
  search.searchParams.set("relevanceLanguage", "ja");
  search.searchParams.set("videoEmbeddable", "true");
  search.searchParams.set("safeSearch", "strict");

  const searchRes = await fetch(search);
  if (!searchRes.ok) {
    console.warn(`[youtube] search failed: ${searchRes.status}`);
    return null;
  }
  const ids = ((await searchRes.json()) as { items?: SearchItem[] }).items
    ?.map((i) => i.id?.videoId)
    .filter((id): id is string => Boolean(id));
  if (!ids?.length) return null;

  // `search.list` does not report embeddability reliably, so confirm it here.
  const details = new URL(VIDEOS_URL);
  details.searchParams.set("key", apiKey);
  details.searchParams.set("part", "snippet,contentDetails,status");
  details.searchParams.set("id", ids.join(","));

  const detailRes = await fetch(details);
  if (!detailRes.ok) {
    console.warn(`[youtube] videos lookup failed: ${detailRes.status}`);
    return null;
  }
  const items = ((await detailRes.json()) as { items?: VideoItem[] }).items ?? [];
  // Restore the relevance order search returned; videos.list sorts by id.
  const byId = new Map(items.map((v) => [v.id, v]));
  const ordered = ids.map((id) => byId.get(id)).filter((v): v is VideoItem => Boolean(v));
  return chooseVideo(ordered);
}

/**
 * The cached video for a unit, searching only if nothing is stored yet.
 *
 * A miss is cached too (as a row with a null video) so a query that finds
 * nothing does not re-spend quota on every request.
 */
export async function getUnitVideo(
  config: AppConfig,
  unitId: string,
  query: string | undefined,
): Promise<UnitVideo | null> {
  if (!query) return null;
  const db = getSql(config);

  if (db) {
    await ensureSchema(db);
    const rows = await db<{ video: UnitVideo | null }[]>`
      select video from unit_videos where unit_id = ${unitId}
    `;
    if (rows.length > 0) return rows[0]!.video;
  }

  if (!config.youtubeApiKey) return null;

  const found = await searchYouTube(config.youtubeApiKey, query).catch((err) => {
    console.warn("[youtube] search error:", err);
    return null;
  });

  if (db) {
    await db`
      insert into unit_videos (unit_id, query, video, updated_at)
      values (${unitId}, ${query}, ${found ? db.json(found as never) : null}, now())
      on conflict (unit_id) do update set
        query = excluded.query, video = excluded.video, updated_at = now()
    `;
  }
  return found;
}

/** Drops a cached result so the next request searches again. */
export async function clearUnitVideo(config: AppConfig, unitId: string): Promise<void> {
  const db = getSql(config);
  if (!db) return;
  await ensureSchema(db);
  await db`delete from unit_videos where unit_id = ${unitId}`;
}
