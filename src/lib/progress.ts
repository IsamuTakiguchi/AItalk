import type { Correction } from "../server/schemas";
import { addDays, dayKey, daysBetween, tzOffsetMin } from "./date";

const STORAGE_KEY = "aitalk.progress.v1";
const CORRUPT_KEY = "aitalk.progress.corrupt";
const SCHEMA_VERSION = 1;

export type ReviewItem = {
  id: string;
  kind: "correction" | "phrase";
  en: string;
  ja: string;
  explanationJa?: string;
  sourceLessonId?: string;
  /** Leitner box; higher means longer until it comes back. */
  box: 0 | 1 | 2 | 3 | 4;
  dueOn: string;
  addedAt: string;
  timesWrong: number;
};

export type LessonRecord = {
  completedAt: string;
  attempts: number;
  bestScore: number | null;
};

export type Progress = {
  schemaVersion: number;
  createdAt: string;
  settings: {
    dailyGoalXp: number;
    voiceUri: string | null;
    speechRate: number;
    jaHintsVisible: boolean;
  };
  streak: {
    current: number;
    longest: number;
    lastActiveDay: string | null;
    lastTzOffsetMin: number | null;
  };
  xp: { total: number; byDay: Record<string, number> };
  lessons: Record<string, LessonRecord>;
  reviewItems: ReviewItem[];
  stats: { utterances: number; talkTurns: number; sessions: number };
};

export const XP_RULES = {
  phraseAttempt: 2,
  phraseGoodBonus: 3,
  talkTurn: 3,
  reviewCleared: 5,
} as const;

/** Score at or above this counts as "good" for bonus XP and clearing a review item. */
export const GOOD_SCORE = 85;
/** Below this, a drilled sentence goes into the review queue. */
export const WEAK_SCORE = 65;

const REVIEW_INTERVALS = [0, 1, 3, 7, 16] as const;
const MAX_REVIEW_ITEMS = 100;
const XP_HISTORY_DAYS = 90;

export function emptyProgress(): Progress {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    settings: { dailyGoalXp: 50, voiceUri: null, speechRate: 0.9, jaHintsVisible: true },
    streak: { current: 0, longest: 0, lastActiveDay: null, lastTzOffsetMin: null },
    xp: { total: 0, byDay: {} },
    lessons: {},
    reviewItems: [],
    stats: { utterances: 0, talkTurns: 0, sessions: 0 },
  };
}

// ---------------------------------------------------------------------------
// Pure state transitions. Kept separate from storage so they are testable and so
// a corrupt store can never take the UI down with it.
// ---------------------------------------------------------------------------

/**
 * Records activity for today and updates the streak.
 *
 * The `diff < 0` branch matters: a learner who flies east, or whose clock moves
 * back, would otherwise have their streak reset to 1. Losing a long streak to a
 * flight is exactly the kind of thing that makes someone abandon an app, so the
 * benefit of the doubt goes to the learner.
 */
export function touchStreak(p: Progress): Progress {
  const today = dayKey();
  const last = p.streak.lastActiveDay;
  const offset = tzOffsetMin();

  if (!last) {
    return { ...p, streak: { current: 1, longest: Math.max(1, p.streak.longest), lastActiveDay: today, lastTzOffsetMin: offset } };
  }

  const diff = daysBetween(last, today);
  let current = p.streak.current;

  if (diff === 0) {
    // Already counted today.
  } else if (diff === 1) {
    current += 1;
  } else if (diff < 0) {
    // Clock or timezone moved backwards — treat as the same day.
  } else {
    current = 1;
  }

  return {
    ...p,
    streak: {
      current,
      longest: Math.max(current, p.streak.longest),
      lastActiveDay: diff < 0 ? last : today,
      lastTzOffsetMin: offset,
    },
  };
}

export function awardXp(p: Progress, amount: number): Progress {
  if (amount <= 0) return p;
  const today = dayKey();
  const byDay = { ...p.xp.byDay, [today]: (p.xp.byDay[today] ?? 0) + amount };

  // Keep the history bounded so localStorage can't grow without limit.
  const cutoff = addDays(today, -XP_HISTORY_DAYS);
  for (const key of Object.keys(byDay)) {
    if (daysBetween(cutoff, key) < 0) delete byDay[key];
  }

  return touchStreak({ ...p, xp: { total: p.xp.total + amount, byDay } });
}

export function xpToday(p: Progress): number {
  return p.xp.byDay[dayKey()] ?? 0;
}

export function goalMet(p: Progress): boolean {
  return xpToday(p) >= p.settings.dailyGoalXp;
}

export function recordLesson(p: Progress, lessonId: string, score: number | null): Progress {
  const prev = p.lessons[lessonId];
  const best = score == null ? (prev?.bestScore ?? null) : Math.max(score, prev?.bestScore ?? 0);
  return {
    ...p,
    lessons: {
      ...p.lessons,
      [lessonId]: {
        completedAt: new Date().toISOString(),
        attempts: (prev?.attempts ?? 0) + 1,
        bestScore: best,
      },
    },
  };
}

export function courseProgress(p: Progress, lessonIds: string[]): { done: number; total: number } {
  return { done: lessonIds.filter((id) => id in p.lessons).length, total: lessonIds.length };
}

// --- review queue -----------------------------------------------------------

/** Stable id so the same mistake merges instead of piling up duplicates. */
function reviewId(kind: ReviewItem["kind"], en: string): string {
  return `${kind}:${en.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim()}`;
}

function upsertReview(
  p: Progress,
  item: Omit<ReviewItem, "id" | "box" | "dueOn" | "addedAt" | "timesWrong">,
): Progress {
  const id = reviewId(item.kind, item.en);
  const existing = p.reviewItems.find((r) => r.id === id);

  const next: ReviewItem = existing
    ? { ...existing, timesWrong: existing.timesWrong + 1, box: 0, dueOn: dayKey() }
    : { ...item, id, box: 0, dueOn: dayKey(), addedAt: new Date().toISOString(), timesWrong: 1 };

  const others = p.reviewItems.filter((r) => r.id !== id);
  // Cap the queue, evicting the best-learned items first.
  const kept = [next, ...others]
    .sort((a, b) => b.timesWrong - a.timesWrong || a.box - b.box)
    .slice(0, MAX_REVIEW_ITEMS);

  return { ...p, reviewItems: kept };
}

export function addCorrectionToReview(
  p: Progress,
  c: Correction,
  sourceLessonId?: string,
): Progress {
  return upsertReview(p, {
    kind: "correction",
    en: c.corrected,
    ja: c.reasonJa,
    explanationJa: c.reasonJa,
    sourceLessonId,
  });
}

export function addPhraseToReview(
  p: Progress,
  phrase: { en: string; ja: string },
  sourceLessonId?: string,
): Progress {
  return upsertReview(p, { kind: "phrase", en: phrase.en, ja: phrase.ja, sourceLessonId });
}

export function dueReviewItems(p: Progress, limit = 10): ReviewItem[] {
  const today = dayKey();
  return p.reviewItems
    .filter((r) => daysBetween(r.dueOn, today) >= 0)
    .sort((a, b) => a.box - b.box || b.timesWrong - a.timesWrong)
    .slice(0, limit);
}

export function dueReviewCount(p: Progress): number {
  const today = dayKey();
  return p.reviewItems.filter((r) => daysBetween(r.dueOn, today) >= 0).length;
}

/** Promote on success, demote on failure, and reschedule by Leitner box. */
export function gradeReviewItem(p: Progress, id: string, passed: boolean): Progress {
  const reviewItems = p.reviewItems.map((r) => {
    if (r.id !== id) return r;
    const box = (passed ? Math.min(4, r.box + 1) : Math.max(0, r.box - 1)) as ReviewItem["box"];
    return {
      ...r,
      box,
      dueOn: addDays(dayKey(), REVIEW_INTERVALS[box]),
      timesWrong: passed ? r.timesWrong : r.timesWrong + 1,
    };
  });
  return { ...p, reviewItems };
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function migrate(raw: unknown): Progress | null {
  if (typeof raw !== "object" || raw === null) return null;
  const candidate = raw as Partial<Progress>;
  if (candidate.schemaVersion !== SCHEMA_VERSION) return null;
  // Merge over defaults so a field added in a patch release can't crash the app.
  const base = emptyProgress();
  return {
    ...base,
    ...candidate,
    settings: { ...base.settings, ...candidate.settings },
    streak: { ...base.streak, ...candidate.streak },
    xp: { ...base.xp, ...candidate.xp },
    stats: { ...base.stats, ...candidate.stats },
    lessons: candidate.lessons ?? {},
    reviewItems: Array.isArray(candidate.reviewItems) ? candidate.reviewItems : [],
  };
}

export function loadProgress(): Progress {
  if (typeof localStorage === "undefined") return emptyProgress();
  let text: string | null = null;
  try {
    text = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private mode or blocked storage — run in memory rather than failing.
    return emptyProgress();
  }
  if (!text) return emptyProgress();

  try {
    const migrated = migrate(JSON.parse(text));
    if (migrated) return migrated;
    throw new Error("unrecognised schema");
  } catch {
    // Never silently discard someone's streak: keep the raw text aside first.
    try {
      localStorage.setItem(CORRUPT_KEY, text);
    } catch { /* out of quota; nothing useful to do */ }
    return emptyProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch { /* quota or blocked storage — state stays in memory for this session */ }
}

export function resetProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* nothing to do */ }
}

/** Export/import exists because iOS Safari evicts script-writable storage after ~7 days of no visits. */
export function exportProgress(p: Progress): string {
  return JSON.stringify(p, null, 2);
}

export function importProgress(text: string): Progress | null {
  try {
    return migrate(JSON.parse(text));
  } catch {
    return null;
  }
}
