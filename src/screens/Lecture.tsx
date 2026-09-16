import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Screen } from "../components/Screen";
import { COURSES } from "../content";
import type { LectureSlide, Unit } from "../content/types";
import { fetchUnitVideo, type UnitVideo } from "../lib/lectureApi";
import { awardXp, recordLesson } from "../lib/progress";
import { useSpeechSynthesis } from "../lib/speech/useSpeechSynthesis";
import { useProgress } from "../lib/useProgress";

/** Lectures are credited like a lesson so they show as done in the unit list. */
export const lectureLessonId = (unitId: string) => `${unitId}-lecture`;
const LECTURE_XP = 10;

function findUnit(unitId: string | undefined): { unit: Unit; courseId: string } | undefined {
  for (const course of COURSES) {
    const unit = course.units.find((u) => u.id === unitId);
    if (unit) return { unit, courseId: course.id };
  }
  return undefined;
}

export function LectureScreen() {
  const { unitId } = useParams();
  const [progress, update] = useProgress();
  const found = findUnit(unitId);
  const tts = useSpeechSynthesis(progress.settings.voiceUri, progress.settings.speechRate);

  const [video, setVideo] = useState<UnitVideo | null>(null);
  const [videoState, setVideoState] = useState<"loading" | "ready" | "none">("loading");
  const [index, setIndex] = useState(0);

  const lecture = found?.unit.lecture;
  const query = lecture?.youtubeQuery;

  useEffect(() => {
    if (!unitId || !query) {
      setVideoState("none");
      return;
    }
    let alive = true;
    void fetchUnitVideo(unitId, query).then((v) => {
      if (!alive) return;
      setVideo(v);
      setVideoState(v ? "ready" : "none");
    });
    return () => {
      alive = false;
    };
  }, [unitId, query]);

  const slides = useMemo(() => lecture?.slides ?? [], [lecture]);

  if (!found || !lecture) return <Navigate to="/courses" replace />;
  const { unit, courseId } = found;
  const slide = slides[index]!;
  const isLast = index === slides.length - 1;

  const finish = () => {
    const id = lectureLessonId(unit.id);
    // Only the first viewing earns XP; re-watching is free but not rewarded.
    if (!(id in progress.lessons)) {
      update((p) => recordLesson(awardXp(p, LECTURE_XP), id, null));
    }
  };

  return (
    <Screen titleJa="解説" subtitleJa={unit.titleJa} back>
      <div className="rounded-2xl glass p-4">
        <p className="text-[11px] font-bold text-brand-600">このユニットのねらい</p>
        <h2 className="mt-1 text-base leading-relaxed font-bold">{lecture.titleJa}</h2>
        <p className="mt-2 text-xs leading-relaxed text-ink-600">🎯 {lecture.goalJa}</p>
      </div>

      <VideoPanel state={videoState} video={video} hasQuery={Boolean(query)} />

      <section className="rounded-2xl glass p-4">
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-400/15">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${((index + 1) / slides.length) * 100}%` }}
            />
          </div>
          <span className="text-[11px] font-medium tabular-nums text-ink-500">
            {index + 1} / {slides.length}
          </span>
        </div>

        <h3 className="mt-4 text-base font-bold">{slide.headingJa}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-700">{slide.bodyJa}</p>

        {slide.example && <ExampleCard example={slide.example} onSpeak={(t) => { tts.unlock(); void tts.speak(t); }} />}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="flex-1 rounded-xl border border-ink-400/25 py-3 text-sm font-semibold text-ink-600 press disabled:opacity-40"
          >
            戻る
          </button>
          {isLast ? (
            <Link
              to={`/courses/${courseId}`}
              onClick={finish}
              className="flex-1 rounded-xl glass-filled py-3 text-center text-sm font-semibold text-white press"
            >
              練習をはじめる
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="flex-1 rounded-xl glass-filled py-3 text-sm font-semibold text-white press"
            >
              次へ
            </button>
          )}
        </div>
      </section>
    </Screen>
  );
}

function ExampleCard({
  example,
  onSpeak,
}: {
  example: NonNullable<LectureSlide["example"]>;
  onSpeak: (text: string) => void;
}) {
  return (
    <div className="mt-3 rounded-xl bg-brand-50 p-3">
      <p className="text-sm font-semibold text-ink-900">{example.en}</p>
      <p className="mt-1 text-xs text-ink-600">{example.ja}</p>
      <button
        type="button"
        onClick={() => onSpeak(example.en)}
        className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-brand-700 press"
      >
        🔈 読み上げる
      </button>
    </div>
  );
}

/**
 * The supporting video, when one was found.
 *
 * Rendered as a click-to-play facade rather than an embedded player. A
 * cross-origin iframe reports nothing when it fails to load, so embedding it
 * directly means a blocked or removed video shows as a dead grey rectangle with
 * no way to recover. A thumbnail *does* report failure, so this can fall back to
 * a plain card that still links out. It also means nothing reaches YouTube until
 * the learner actually chooses to watch.
 *
 * Labelled as a third-party reference rather than as this app's own teacher: the
 * video is whatever the search returned, and presenting someone else's upload as
 * our instructor would misrepresent both them and the lesson.
 */
function VideoPanel({
  state,
  video,
  hasQuery,
}: {
  state: "loading" | "ready" | "none";
  video: UnitVideo | null;
  hasQuery: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [thumbBroken, setThumbBroken] = useState(false);

  if (state === "loading") {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl bg-ink-800/5">
        <span className="text-xs text-ink-400">参考動画を探しています…</span>
      </div>
    );
  }

  if (state === "none" || !video) {
    // Silent when no query was configured; only explain when one was tried.
    if (!hasQuery) return null;
    return (
      <p className="rounded-xl bg-ink-800/5 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
        このユニットに合う参考動画は見つかりませんでした。下の解説だけで進められます。
      </p>
    );
  }

  const watchUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
  const thumb = video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`;

  return (
    <section className="overflow-hidden rounded-2xl glass">
      {playing ? (
        <div className="aspect-video w-full bg-black">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${video.videoId}?rel=0&playsinline=1&autoplay=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : thumbBroken ? (
        // The thumbnail could not load, so the player almost certainly cannot
        // either. Offer the link instead of a box that will never fill in.
        <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-ink-800/5 px-4 text-center">
          <span className="text-2xl">📺</span>
          <p className="text-[11px] leading-relaxed text-ink-500">
            動画を読み込めませんでした。YouTube で直接開けます。
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`参考動画を再生: ${video.title}`}
          className="relative block aspect-video w-full bg-ink-800/5"
        >
          <img
            src={thumb}
            alt=""
            loading="lazy"
            onError={() => setThumbBroken(true)}
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/65 text-xl text-white">
              ▶
            </span>
          </span>
        </button>
      )}

      <div className="p-3">
        <p className="text-xs leading-relaxed font-medium text-ink-800">{video.title}</p>
        <p className="mt-0.5 text-[11px] text-ink-500">{video.channel}</p>
        <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
          YouTube 上の第三者による参考動画で、AItalk が制作したものではありません。
          内容はこのユニットと完全に対応しているとは限りません。
        </p>
        <a
          href={watchUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1 inline-block text-[11px] font-medium text-brand-600 underline"
        >
          YouTube で開く
        </a>
      </div>
    </section>
  );
}
