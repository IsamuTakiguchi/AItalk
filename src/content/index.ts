import { courseBasics } from "./course-basics";
import { courseBusiness } from "./course-business";
import { courseDaily } from "./course-daily";
import type { Course, Lesson } from "./types";

export const COURSES: Course[] = [courseBasics, courseDaily, courseBusiness];

export const ALL_LESSONS: Lesson[] = COURSES.flatMap((c) =>
  c.units.flatMap((u) => u.lessons),
);

const lessonIndex = new Map(ALL_LESSONS.map((l) => [l.id, l]));
const courseIndex = new Map(COURSES.map((c) => [c.id, c]));

export function getLesson(id: string | undefined): Lesson | undefined {
  return id ? lessonIndex.get(id) : undefined;
}

export function getCourse(id: string | undefined): Course | undefined {
  return id ? courseIndex.get(id) : undefined;
}

/** The course and unit a lesson belongs to, for breadcrumbs and result screens. */
export function locateLesson(lessonId: string) {
  for (const course of COURSES) {
    for (const unit of course.units) {
      if (unit.lessons.some((l) => l.id === lessonId)) return { course, unit };
    }
  }
  return undefined;
}

/** The next lesson in curriculum order, for "continue" and end-of-lesson flow. */
export function nextLessonAfter(lessonId: string): Lesson | undefined {
  const i = ALL_LESSONS.findIndex((l) => l.id === lessonId);
  return i >= 0 ? ALL_LESSONS[i + 1] : undefined;
}

/** The first lesson the learner has not completed — what "続きから" resumes. */
export function firstIncompleteLesson(completed: Record<string, unknown>): Lesson {
  return ALL_LESSONS.find((l) => !(l.id in completed)) ?? ALL_LESSONS[0]!;
}

/** Standalone free-talk topics for the 会話 tab, independent of the courses. */
export const TALK_TOPICS = [
  { id: "day", emoji: "☀️", titleJa: "今日のこと", topic: "how your day has been so far", starters: ["My day's been pretty busy.", "Nothing much happened today.", "Actually, something good happened."] },
  { id: "food", emoji: "🍜", titleJa: "食べもの", topic: "food you like, cooking, and restaurants", starters: ["I love ramen more than anything.", "I've started cooking at home more.", "I'm a pretty picky eater."] },
  { id: "travel", emoji: "🗺️", titleJa: "旅行", topic: "travel, places you've been and places you want to go", starters: ["I'd love to visit Europe someday.", "My last trip was to Korea.", "I prefer staying close to home."] },
  { id: "work", emoji: "💻", titleJa: "仕事", topic: "your job and working life", starters: ["Work has been really busy lately.", "I'm thinking about changing jobs.", "I actually really like my job."] },
  { id: "movies", emoji: "🎬", titleJa: "映画とドラマ", topic: "films and TV shows you've watched recently", starters: ["I watched something great last night.", "I mostly watch documentaries.", "I don't really watch much TV."] },
  { id: "study", emoji: "📚", titleJa: "英語学習", topic: "learning English and what you find difficult about it",  starters: ["Listening is the hardest part for me.", "I've been studying for three years.", "I want to speak more naturally."] },
  { id: "weekend", emoji: "🌿", titleJa: "週末の予定", topic: "your plans for the weekend", starters: ["I don't have any plans yet.", "I'm meeting some friends.", "I just want to sleep, honestly."] },
  { id: "hometown", emoji: "🏠", titleJa: "地元のこと", topic: "your hometown and what it's like", starters: ["I grew up in a small town.", "My hometown is famous for its food.", "I moved away when I was eighteen."] },
] as const;
