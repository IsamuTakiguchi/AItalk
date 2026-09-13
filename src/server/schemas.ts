import { z } from "zod";

export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type Level = (typeof LEVELS)[number];

/** A single tutor correction of something the learner said. */
export const CorrectionSchema = z.object({
  original: z.string(),
  corrected: z.string(),
  reasonJa: z.string(),
  kind: z.enum(["grammar", "naturalness", "vocabulary"]),
});
export type Correction = z.infer<typeof CorrectionSchema>;

/**
 * One tutor turn. This is the structured-output schema handed to Claude, so it
 * deliberately avoids JSON-Schema keywords that structured outputs may reject
 * (no min/max) — `expressionScore` is clamped server-side instead.
 */
export const TutorTurnSchema = z.object({
  reply: z.string(),
  replyJa: z.string(),
  corrections: z.array(CorrectionSchema),
  suggestions: z.array(z.string()),
  expressionScore: z.number(),
});
export type TutorTurn = z.infer<typeof TutorTurnSchema>;

export const ScenarioSchema = z.object({
  title: z.string(),
  tutorRole: z.string(),
  userRole: z.string(),
  goal: z.string(),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const TutorRequestSchema = z.object({
  mode: z.enum(["freetalk", "roleplay"]),
  level: z.enum(LEVELS),
  scenario: ScenarioSchema.optional(),
  topic: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .max(40),
  userText: z.string().min(1).max(2000),
});
export type TutorRequest = z.infer<typeof TutorRequestSchema>;

/** Deeper Japanese explanation of one correction, for the review screen. */
export const CoachNoteSchema = z.object({
  titleJa: z.string(),
  explanationJa: z.string(),
  examples: z.array(z.object({ en: z.string(), ja: z.string() })),
});
export type CoachNote = z.infer<typeof CoachNoteSchema>;

export const CoachRequestSchema = z.object({
  original: z.string().min(1).max(500),
  corrected: z.string().min(1).max(500),
});
export type CoachRequest = z.infer<typeof CoachRequestSchema>;

export type HealthResponse = {
  ok: true;
  aiEnabled: boolean;
  /** False when Google sign-in is not configured, so the UI can say so plainly. */
  loginConfigured: boolean;
};

/**
 * Validation for a stored progress blob.
 *
 * Deliberately permissive about unknown keys: an older client must still be able
 * to save after the shape grows, and the merge on the server side is what keeps
 * the stored value coherent. The point here is to reject a payload that is not
 * progress at all, not to police every field.
 */
const LessonRecordSchema = z.object({
  completedAt: z.string(),
  attempts: z.number(),
  bestScore: z.number().nullable(),
});

const ReviewItemSchema = z.object({
  id: z.string(),
  kind: z.enum(["correction", "phrase"]),
  en: z.string(),
  ja: z.string(),
  explanationJa: z.string().optional(),
  sourceLessonId: z.string().optional(),
  // Clamped rather than merely validated: a box outside 0-4 would break the
  // review scheduler's interval lookup, and rejecting the whole save over one
  // bad item would cost the learner their session.
  box: z
    .number()
    .transform((n) => Math.min(4, Math.max(0, Math.round(n))) as 0 | 1 | 2 | 3 | 4),
  dueOn: z.string(),
  addedAt: z.string(),
  timesWrong: z.number(),
});

export const ProgressSchema = z.object({
  schemaVersion: z.number(),
  createdAt: z.string(),
  settings: z.object({
    dailyGoalXp: z.number(),
    // Device-local: the client strips these before syncing, so they arrive
    // absent and are filled in with placeholders the client immediately
    // overrides with its own device's values.
    voiceUri: z.string().nullable().default(null),
    speechRate: z.number().default(0.9),
    jaHintsVisible: z.boolean(),
  }),
  streak: z.object({
    current: z.number(),
    longest: z.number(),
    lastActiveDay: z.string().nullable(),
    lastTzOffsetMin: z.number().nullable(),
  }),
  xp: z.object({ total: z.number(), byDay: z.record(z.string(), z.number()) }),
  lessons: z.record(z.string(), LessonRecordSchema),
  reviewItems: z.array(ReviewItemSchema).max(500),
  stats: z.object({
    utterances: z.number(),
    talkTurns: z.number(),
    sessions: z.number(),
  }),
});

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
