import { Link } from "react-router-dom";
import { LessonCard } from "../components/LessonCard";
import { Screen } from "../components/Screen";
import { StreakHeader } from "../components/StreakHeader";
import { MockModeBanner } from "../components/UnsupportedBrowserNotice";
import { COURSES, firstIncompleteLesson, locateLesson } from "../content";
import { courseProgress, dueReviewCount } from "../lib/progress";
import { useAiEnabled } from "../lib/useHealth";
import { useProgress } from "../lib/useProgress";

export function Home() {
  const [progress] = useProgress();
  const aiEnabled = useAiEnabled();
  const nextLesson = firstIncompleteLesson(progress.lessons);
  const where = locateLesson(nextLesson.id);
  const reviewDue = dueReviewCount(progress);

  return (
    <Screen titleJa="AItalk" subtitleJa="英語は、話した分だけうまくなる">
      {aiEnabled === false && <MockModeBanner />}

      <StreakHeader progress={progress} />

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-ink-600">続きから</h2>
        <LessonCard lesson={nextLesson} record={progress.lessons[nextLesson.id]} />
        {where && (
          <p className="px-1 text-[11px] text-ink-400">
            {where.course.titleJa} ・ {where.unit.titleJa}
          </p>
        )}
      </section>

      {reviewDue > 0 && (
        <Link
          to="/review"
          className="flex items-center gap-3 rounded-xl border border-bad/20 bg-bad/5 p-3 press"
        >
          <span className="text-xl">🔁</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink-800">復習が {reviewDue} 件たまっています</p>
            <p className="text-[11px] text-ink-500">間違えた表現をもう一度言ってみましょう</p>
          </div>
          <span className="text-ink-400">›</span>
        </Link>
      )}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-ink-600">コース</h2>
          <Link to="/courses" className="text-xs font-medium text-brand-600">
            すべて見る
          </Link>
        </div>
        {COURSES.map((course, i) => {
          const ids = course.units.flatMap((u) => u.lessons.map((l) => l.id));
          const { done, total } = courseProgress(progress, ids);
          return (
            <Link
              key={course.id}
              to={`/courses/${course.id}`}
              className="rise-in flex items-center gap-3 rounded-xl glass p-3 press"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="text-2xl">{course.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{course.titleJa}</p>
                <p className="truncate text-[11px] text-ink-500">
                  {course.levelLabel}・{done}/{total} レッスン
                </p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ink-400/15">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <span className="text-ink-400">›</span>
            </Link>
          );
        })}
      </section>

      <Link
        to="/talk"
        className="flex items-center gap-3 rounded-xl glass-filled p-4 text-white press"
      >
        <span className="text-2xl">💬</span>
        <div className="flex-1">
          <p className="text-sm font-bold">AI講師とフリートーク</p>
          <p className="text-[11px] text-brand-100">好きな話題で、いつでも英会話</p>
        </div>
        <span className="text-brand-200">›</span>
      </Link>
    </Screen>
  );
}
