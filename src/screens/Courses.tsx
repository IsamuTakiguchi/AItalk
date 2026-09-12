import { Link } from "react-router-dom";
import { Screen } from "../components/Screen";
import { COURSES } from "../content";
import { courseProgress } from "../lib/progress";
import { useProgress } from "../lib/useProgress";

export function Courses() {
  const [progress] = useProgress();

  return (
    <Screen titleJa="コース" subtitleJa="レベルに合わせて順番に進めましょう">
      {COURSES.map((course) => {
        const ids = course.units.flatMap((u) => u.lessons.map((l) => l.id));
        const { done, total } = courseProgress(progress, ids);
        return (
          <Link
            key={course.id}
            to={`/courses/${course.id}`}
            className="block rounded-2xl bg-white p-4 shadow-sm active:scale-[0.99]"
          >
            <div className="flex items-start gap-3">
              <span className="text-3xl">{course.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-base font-bold">{course.titleJa}</h2>
                  <span className="shrink-0 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand-700">
                    {course.levelLabel}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{course.subtitleJa}</p>
                <p className="mt-2 text-[11px] font-medium text-ink-600">
                  {done} / {total} レッスン完了
                </p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-400/15">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </Screen>
  );
}
