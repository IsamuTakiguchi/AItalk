import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { BottomNav } from "./components/BottomNav";
import { PasscodeGate } from "./components/PasscodeGate";
import { verifyPasscode } from "./lib/api";
import { clearPasscode, getPasscode } from "./lib/passcode";
import { dueReviewCount } from "./lib/progress";
import { useHealth } from "./lib/useHealth";
import { useProgress } from "./lib/useProgress";
import { CourseDetail } from "./screens/CourseDetail";
import { Courses } from "./screens/Courses";
import { FreeTalk } from "./screens/FreeTalk";
import { Home } from "./screens/Home";
import { LessonScreen } from "./screens/Lesson";
import { Profile } from "./screens/Profile";
import { Review } from "./screens/Review";
import { TalkSession } from "./screens/TalkSession";

/** Immersive screens hide the tab bar so the mic button owns the thumb zone. */
const IMMERSIVE = [/^\/lesson\//, /^\/talk\/.+/, /^\/review$/];

export function App() {
  const [progress] = useProgress();
  const { pathname } = useLocation();
  const { health } = useHealth();
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const immersive = IMMERSIVE.some((re) => re.test(pathname));

  // Validate any stored code once the server tells us one is required. Done
  // against /api/verify, which runs no AI request and costs no rate budget.
  useEffect(() => {
    if (!health) return;
    if (!health.passcodeRequired) {
      setUnlocked(true);
      return;
    }
    const stored = getPasscode();
    if (!stored) {
      setUnlocked(false);
      return;
    }
    void verifyPasscode(stored).then((ok) => {
      if (!ok) clearPasscode();
      setUnlocked(ok);
    });
  }, [health]);

  if (health && unlocked === false) {
    return (
      <div className="mx-auto h-[100dvh] w-full max-w-[480px]">
        <PasscodeGate onUnlocked={() => setUnlocked(true)} />
      </div>
    );
  }

  return (
    // 100dvh, not 100vh: iOS Safari's toolbar makes vh taller than the viewport.
    <div className="flex h-[100dvh] flex-col">
      <main className="mx-auto w-full max-w-[480px] flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:courseId" element={<CourseDetail />} />
          <Route path="/lesson/:lessonId" element={<LessonScreen />} />
          <Route path="/talk" element={<FreeTalk />} />
          <Route path="/talk/:topicId" element={<TalkSession />} />
          <Route path="/review" element={<Review />} />
          <Route path="/me" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!immersive && <BottomNav reviewCount={dueReviewCount(progress)} />}
    </div>
  );
}
