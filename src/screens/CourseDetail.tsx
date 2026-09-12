import { Navigate, useParams } from "react-router-dom";
import { LessonCard } from "../components/LessonCard";
import { Screen } from "../components/Screen";
import { getCourse } from "../content";
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
            {unit.lessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} record={progress.lessons[lesson.id]} />
            ))}
          </div>
        </section>
      ))}
    </Screen>
  );
}
