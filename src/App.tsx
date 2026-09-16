import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { BottomNav, NAV_HEIGHT } from "./components/BottomNav";
import { dueReviewCount } from "./lib/progress";
import { useHealth } from "./lib/useHealth";
import { hydrateFromServer, stopSync, useProgress } from "./lib/useProgress";
import { useSession } from "./lib/useSession";
import { CourseDetail } from "./screens/CourseDetail";
import { Courses } from "./screens/Courses";
import { FreeTalk } from "./screens/FreeTalk";
import { Home } from "./screens/Home";
import { LectureScreen } from "./screens/Lecture";
import { LessonScreen } from "./screens/Lesson";
import { Login } from "./screens/Login";
import { Profile } from "./screens/Profile";
import { Review } from "./screens/Review";
import { TalkSession } from "./screens/TalkSession";

/** Immersive screens hide the tab bar so the mic button owns the thumb zone. */
const IMMERSIVE = [/^\/lesson\//, /^\/lecture\//, /^\/talk\/.+/, /^\/review$/];

export function App() {
  const [progress] = useProgress();
  const { pathname } = useLocation();
  const { health } = useHealth();
  const { session, signOut } = useSession();
  const [hydrated, setHydrated] = useState(false);
  const immersive = IMMERSIVE.some((re) => re.test(pathname));

  // Pull the account's progress once signed in, merging this device's history
  // into it. Rendering waits for this so the first paint is not stale data that
  // visibly jumps a moment later.
  useEffect(() => {
    if (session.status !== "in") {
      stopSync();
      setHydrated(false);
      return;
    }
    let alive = true;
    void hydrateFromServer().finally(() => {
      if (alive) setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, [session.status]);

  if (session.status === "loading") return <Splash />;
  if (session.status === "out") {
    return (
      <div className="mx-auto w-full max-w-[480px]">
        <div className="aurora" aria-hidden />
        <Login loginConfigured={health ? health.loginConfigured : null} />
      </div>
    );
  }
  if (!hydrated) return <Splash />;

  return (
    // 100dvh, not 100vh: iOS Safari's toolbar makes vh taller than the viewport.
    // `relative` so the tab bar can overlay the scroll area rather than sit in a
    // row of its own — content has to pass *under* the glass for it to read as
    // glass at all.
    <div className="relative flex h-[100dvh] flex-col">
      <div className="aurora" aria-hidden />
      <main
        className="mx-auto w-full max-w-[480px] flex-1 overflow-y-auto"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          // Clears the overlaid tab bar so the last card is never trapped
          // behind it. NAV_HEIGHT is the bar's own height; the safe-area inset
          // is the home indicator below it.
          paddingBottom: immersive ? 0 : `calc(${NAV_HEIGHT}px + env(safe-area-inset-bottom))`,
        }}
      >
        <Routes key={pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:courseId" element={<CourseDetail />} />
          <Route path="/lecture/:unitId" element={<LectureScreen />} />
          <Route path="/lesson/:lessonId" element={<LessonScreen />} />
          <Route path="/talk" element={<FreeTalk />} />
          <Route path="/talk/:topicId" element={<TalkSession />} />
          <Route path="/review" element={<Review />} />
          <Route path="/me" element={<Profile user={session.user} onSignOut={signOut} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!immersive && <BottomNav reviewCount={dueReviewCount(progress)} />}
    </div>
  );
}

/** Shown while the session and progress resolve — never a blank screen. */
function Splash() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3">
      <div className="aurora" aria-hidden />
      <span className="text-4xl" style={{ animation: "rise-in 0.6s var(--ease-spring) both" }}>
        🗣️
      </span>
      <span className="text-xs font-medium text-ink-400">読み込み中…</span>
    </div>
  );
}
