import { Navigate, useParams } from "react-router-dom";
import { lectureLessonId } from "./Lecture";
import { Link } from "react-router-dom";
import { LessonCard } from "../components/LessonCard";
import { Screen } from "../components/Screen";
import { getCourse } from "../content";
import type { Course } from "../content/types";
import { courseProgress } from "../lib/progress";
import { useProgress } from "../lib/useProgress";

export function CourseDetail() {
  const { courseId } = useParams();
  const [progress] = useProgress();
  const course = getCourse(courseId);

  if (!course) return <Navigate to="/courses" replace />;

  const ids = course.units.flatMap((u) => u.lessons.map((l) => l.id));
  const { done, total } = courseProgress(progress, ids);

  return (
    <Screen titleJa={course.titleJa} subtitleJa={`${course.levelLabel}・${done}/${total} 完了`} back>
      {course.units.map((unit, i) => (
        <section key={unit.id} className="space-y-2">
          <div className="flex items-baseline gap-2 px-1">
            <span className="text-[11px] font-bold text-brand-600">UNIT {i + 1}</span>
            <h2 className="text-sm font-bold">{unit.titleJa}</h2>
          </div>
          <p className="px-1 text-[11px] leading-relaxed text-ink-500">{unit.descJa}</p>
          <div className="space-y-2">
            <LectureRow unit={unit} done={lectureLessonId(unit.id) in progress.lessons} />
            {unit.lessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} record={progress.lessons[lesson.id]} />
            ))}
          </div>
        </section>
      ))}
    </Screen>
  );
}

/** The unit's opening explanation, sitting above its lessons. */
function LectureRow({ unit, done }: { unit: Course["units"][number]; done: boolean }) {
  return (
    <Link
      to={`/lecture/${unit.id}`}
      className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3 transition active:scale-[0.99]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg">
        {done ? "✓" : "🎬"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-brand-700">まずは解説を見る</p>
        <p className="truncate text-[11px] text-ink-500">{unit.lecture.titleJa}</p>
      </div>
      <span className="text-brand-400">›</span>
    </Link>
  );
}
