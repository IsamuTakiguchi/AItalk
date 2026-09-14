import type { Level } from "../server/schemas";

export type { Level };

export type LessonKind = "phrase" | "roleplay" | "freetalk";

export type Phrase = {
  en: string;
  ja: string;
  /** Words worth emphasising in the drill UI (tricky sounds, key vocabulary). */
  focus?: string[];
};

export type Scenario = {
  title: string;
  tutorRole: string;
  userRole: string;
  goal: string;
};

type LessonBase = {
  id: string;
  titleJa: string;
  subtitleJa: string;
  level: Level;
  estMinutes: number;
  xp: number;
};

export type PhraseLesson = LessonBase & {
  kind: "phrase";
  phrases: Phrase[];
};

export type RoleplayLesson = LessonBase & {
  kind: "roleplay";
  scenario: Scenario;
  /**
   * Static first line, spoken by the tutor. Being content rather than an API call
   * means every role play starts instantly instead of after a round trip.
   */
  openingLine: string;
  openingLineJa: string;
  keyPhrases: Phrase[];
  maxTurns: number;
};

export type FreeTalkLesson = LessonBase & {
  kind: "freetalk";
  topic: string;
  promptJa: string;
  starters: string[];
  maxTurns: number;
};

export type Lesson = PhraseLesson | RoleplayLesson | FreeTalkLesson;

/**
 * One card of the unit's opening explanation.
 *
 * Authored here rather than fetched, so the lecture always exists even when no
 * video can be found or played. `en` is read aloud; `ja` is the explanation.
 */
export type LectureSlide = {
  headingJa: string;
  bodyJa: string;
  /** Optional example read aloud by the speech synthesiser. */
  example?: { en: string; ja: string };
};

export type UnitLecture = {
  titleJa: string;
  /** What the learner should be able to do after the unit. */
  goalJa: string;
  slides: LectureSlide[];
  /**
   * Search terms used to look for a supporting YouTube video.
   *
   * The result is a third-party video, not a lesson produced for this app, so
   * the UI labels it as a reference rather than as "the teacher". Absent means
   * no video is looked for at all.
   */
  youtubeQuery?: string;
};

export type Unit = {
  id: string;
  titleJa: string;
  descJa: string;
  /** Shown before the unit's lessons, as Speak opens a unit with a video. */
  lecture: UnitLecture;
  lessons: Lesson[];
};

export type Course = {
  id: string;
  titleJa: string;
  subtitleJa: string;
  emoji: string;
  level: Level;
  levelLabel: string;
  units: Unit[];
};
