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

export type Unit = {
  id: string;
  titleJa: string;
  descJa: string;
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
