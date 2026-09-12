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

export type HealthResponse = { ok: true; aiEnabled: boolean };

export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
