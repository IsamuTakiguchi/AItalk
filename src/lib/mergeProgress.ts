import type { LessonRecord, Progress, ReviewItem } from "./progress";

/**
 * Deterministic merge of two Progress snapshots.
 *
 * The app is used from more than one device, and writing the whole blob with
 * last-write-wins would silently drop whichever device saved second. Returning a
 * conflict instead would mean showing "could not save" in the middle of a lesson.
 * So every write merges rather than replaces.
 *
 * Two properties make that safe, and the tests assert both:
 *   - idempotent: merge(a, a) === a, so a retried request changes nothing.
 *   - commutative: merge(a, b) === merge(b, a), so request ordering is irrelevant.
 *
 * Achieved by taking the *maximum* of every counter rather than summing, which
 * also means a replayed request can never inflate someone's XP.
 *
 * `settings` is the deliberate exception — see below.
 */

const max = (a: number | undefined, b: number | undefined): number =>
  Math.max(a ?? 0, b ?? 0);

/** Later of two `YYYY-MM-DD` keys or ISO timestamps; both sort lexicographically. */
function later(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a >= b ? a : b;
}

function earlier(a: string | undefined, b: string | undefined): string {
  if (!a) return b ?? new Date().toISOString();
  if (!b) return a;
  return a <= b ? a : b;
}

type Streak = Progress["streak"];

/** The timezone of the more recent activity; ties break on the numeric value. */
function mostRecentTz(a: Streak, b: Streak): number | null {
  if (a.lastActiveDay === b.lastActiveDay) {
    if (a.lastTzOffsetMin == null) return b.lastTzOffsetMin;
    if (b.lastTzOffsetMin == null) return a.lastTzOffsetMin;
    return Math.max(a.lastTzOffsetMin, b.lastTzOffsetMin);
  }
  const newer = later(a.lastActiveDay, b.lastActiveDay) === a.lastActiveDay ? a : b;
  return newer.lastTzOffsetMin ?? (newer === a ? b : a).lastTzOffsetMin;
}

function mergeByDay(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [day, xp] of Object.entries(b)) out[day] = max(out[day], xp);
  return out;
}

function mergeLessons(
  a: Record<string, LessonRecord>,
  b: Record<string, LessonRecord>,
): Record<string, LessonRecord> {
  const out: Record<string, LessonRecord> = { ...a };
  for (const [id, rec] of Object.entries(b)) {
    const prev = out[id];
    out[id] = prev
      ? {
          completedAt: later(prev.completedAt, rec.completedAt) ?? rec.completedAt,
          attempts: max(prev.attempts, rec.attempts),
          bestScore:
            prev.bestScore == null && rec.bestScore == null
              ? null
              : max(prev.bestScore ?? 0, rec.bestScore ?? 0),
        }
      : rec;
  }
  return out;
}

function mergeReviewItems(a: ReviewItem[], b: ReviewItem[]): ReviewItem[] {
  const out = new Map<string, ReviewItem>();
  for (const item of [...a, ...b]) {
    const prev = out.get(item.id);
    if (!prev) {
      out.set(item.id, item);
      continue;
    }
    // The higher Leitner box wins, matching the "never lose progress" rule used
    // for every other counter. `timesWrong` still takes the max, so a struggle
    // recorded on the other device is not forgotten even when its box loses.
    const winner = item.box > prev.box ? item : prev;
    const loser = winner === item ? prev : item;
    out.set(item.id, {
      ...winner,
      timesWrong: max(winner.timesWrong, loser.timesWrong),
      dueOn: winner.box === loser.box ? (later(winner.dueOn, loser.dueOn) ?? winner.dueOn) : winner.dueOn,
      addedAt: earlier(winner.addedAt, loser.addedAt),
    });
  }
  return [...out.values()];
}

/**
 * Merges `incoming` into `base`.
 *
 * `settings` intentionally takes `incoming` wholesale rather than merging: a
 * preference is not progress, and "I just turned the Japanese hints off" must
 * win over an older value. This is the one field where the result depends on
 * argument order, which is why callers pass the newer snapshot as `incoming`.
 */
export function mergeProgress(base: Progress, incoming: Progress): Progress {
  return {
    schemaVersion: Math.max(base.schemaVersion, incoming.schemaVersion),
    createdAt: earlier(base.createdAt, incoming.createdAt),
    settings: { ...base.settings, ...incoming.settings },
    streak: {
      current: max(base.streak.current, incoming.streak.current),
      longest: max(base.streak.longest, incoming.streak.longest),
      lastActiveDay: later(base.streak.lastActiveDay, incoming.streak.lastActiveDay),
      // Tied to whichever device was active most recently rather than to argument
      // order, so two devices in different timezones still converge on one answer.
      lastTzOffsetMin: mostRecentTz(base.streak, incoming.streak),
    },
    xp: {
      total: max(base.xp.total, incoming.xp.total),
      byDay: mergeByDay(base.xp.byDay, incoming.xp.byDay),
    },
    lessons: mergeLessons(base.lessons, incoming.lessons),
    reviewItems: mergeReviewItems(base.reviewItems, incoming.reviewItems),
    stats: {
      utterances: max(base.stats.utterances, incoming.stats.utterances),
      talkTurns: max(base.stats.talkTurns, incoming.stats.talkTurns),
      sessions: max(base.stats.sessions, incoming.stats.sessions),
    },
  };
}

/**
 * Settings that belong to the account rather than the device.
 *
 * `voiceUri` and `speechRate` are deliberately excluded: a voice that exists on
 * an iPhone does not exist on a Windows laptop, so syncing the choice would push
 * a broken value to the other device.
 */
const SYNCED_SETTINGS = ["dailyGoalXp", "jaHintsVisible"] as const;

/** Strips device-local settings before sending a snapshot to the server. */
export function toSyncPayload(p: Progress): Progress {
  const settings = {} as Progress["settings"];
  for (const key of SYNCED_SETTINGS) {
    (settings as Record<string, unknown>)[key] = p.settings[key];
  }
  return { ...p, settings };
}

/** Merges a server snapshot into local state, keeping this device's own settings. */
export function applyServerProgress(local: Progress, server: Progress): Progress {
  const merged = mergeProgress(server, local);
  return {
    ...merged,
    settings: {
      ...merged.settings,
      // Device-local choices always come from this device.
      voiceUri: local.settings.voiceUri,
      speechRate: local.settings.speechRate,
    },
  };
}
