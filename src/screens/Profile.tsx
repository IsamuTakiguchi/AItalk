import { useMemo, useRef, useState } from "react";
import { Screen } from "../components/Screen";
import { recentDays, weekdayJa } from "../lib/date";
import {
  dueReviewCount,
  emptyProgress,
  exportProgress,
  importProgress,
  resetProgress,
} from "../lib/progress";
import { probeSpeechSupport } from "../lib/speech/support";
import { useSpeechRecognition } from "../lib/speech/useSpeechRecognition";
import { useSpeechSynthesis } from "../lib/speech/useSpeechSynthesis";
import { useAiEnabled } from "../lib/useHealth";
import { setProgress, useProgress } from "../lib/useProgress";

const GOALS = [20, 50, 100];

export function Profile() {
  const [progress, update] = useProgress();
  const aiEnabled = useAiEnabled();
  const support = useMemo(() => probeSpeechSupport(), []);
  const tts = useSpeechSynthesis(progress.settings.voiceUri, progress.settings.speechRate);
  const stt = useSpeechRecognition();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const days = recentDays(7);
  const maxXp = Math.max(progress.settings.dailyGoalXp, ...days.map((d) => progress.xp.byDay[d] ?? 0));

  const download = () => {
    const blob = new Blob([exportProgress(progress)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aitalk-progress-${days[days.length - 1]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (file: File) => {
    const imported = importProgress(await file.text());
    if (!imported) {
      setImportMsg("読み込めませんでした。AItalk で書き出したファイルを選んでください。");
      return;
    }
    setProgress(imported);
    setImportMsg("学習データを読み込みました。");
  };

  return (
    <Screen titleJa="マイページ">
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-ink-600">学習の記録</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { v: progress.xp.total, label: "累計 XP" },
            { v: progress.streak.current, label: "連続日数" },
            { v: Object.keys(progress.lessons).length, label: "完了レッスン" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-brand-50 py-3">
              <p className="text-xl font-bold tabular-nums text-brand-700">{s.v}</p>
              <p className="text-[10px] text-ink-500">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <p className="text-[11px] font-medium text-ink-500">この 7 日間</p>
          <div className="mt-2 flex h-24 items-end gap-1.5">
            {days.map((day) => {
              const xp = progress.xp.byDay[day] ?? 0;
              const met = xp >= progress.settings.dailyGoalXp;
              return (
                <div key={day} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className={`w-full rounded-t transition-all ${met ? "bg-good" : "bg-brand-400"}`}
                      style={{ height: `${maxXp ? Math.max(3, (xp / maxXp) * 100) : 3}%` }}
                      title={`${day}: ${xp} XP`}
                    />
                  </div>
                  <span className="text-[9px] text-ink-400">{weekdayJa(day)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-ink-600">設定</h2>

        <div className="mt-3">
          <p className="text-xs font-medium">1日の目標</p>
          <div className="mt-2 flex gap-2">
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => update((p) => ({ ...p, settings: { ...p.settings, dailyGoalXp: g } }))}
                className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${
                  progress.settings.dailyGoalXp === g
                    ? "bg-brand-600 text-white"
                    : "border border-ink-400/25 text-ink-600"
                }`}
              >
                {g} XP
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 flex items-center justify-between">
          <span className="text-xs font-medium">日本語訳を最初から表示</span>
          <input
            type="checkbox"
            checked={progress.settings.jaHintsVisible}
            onChange={(e) =>
              update((p) => ({ ...p, settings: { ...p.settings, jaHintsVisible: e.target.checked } }))
            }
            className="h-5 w-5 accent-brand-600"
          />
        </label>

        <div className="mt-4">
          <p className="text-xs font-medium">読み上げの速さ（{progress.settings.speechRate.toFixed(1)}）</p>
          <input
            type="range"
            min={0.6}
            max={1.2}
            step={0.1}
            value={progress.settings.speechRate}
            onChange={(e) =>
              update((p) => ({ ...p, settings: { ...p.settings, speechRate: Number(e.target.value) } }))
            }
            className="mt-1 w-full accent-brand-600"
          />
        </div>

        {tts.voices.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium">読み上げの声</p>
            <select
              value={tts.voice?.voiceURI ?? ""}
              onChange={(e) =>
                update((p) => ({ ...p, settings: { ...p.settings, voiceUri: e.target.value || null } }))
              }
              className="mt-1 w-full rounded-xl border border-ink-400/25 bg-white px-3 py-2 text-xs"
            >
              {tts.voices
                .filter((v) => v.lang.replace("_", "-").toLowerCase().startsWith("en"))
                .map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
            </select>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-ink-600">マイクと音声のテスト</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
          {support.canSpeak
            ? "マイクを押して英語で何か話すと、聞き取った文が表示されます。"
            : (support.reasonJa ?? "この環境では音声入力が使えません。")}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => {
              tts.unlock();
              void tts.speak("Hello! This is how the tutor will sound.");
            }}
            className="rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 active:scale-95"
          >
            🔈 声を聞く
          </button>
          {support.canSpeak && (
            <button
              type="button"
              onClick={() => {
                tts.cancel();
                stt.isListening ? stt.stop() : stt.start();
              }}
              className="rounded-lg bg-ink-400/10 px-3 py-2 text-xs font-semibold text-ink-600 active:scale-95"
            >
              {stt.isListening ? "■ 停止" : "🎤 マイクを試す"}
            </button>
          )}
        </div>
        {(stt.interim || stt.final) && (
          <p className="mt-2 rounded-lg bg-ink-800/5 p-2 text-xs text-ink-800">
            {stt.final || stt.interim}
          </p>
        )}
        {stt.errorJa && <p className="mt-2 text-xs text-near">{stt.errorJa}</p>}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-ink-600">学習データ</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
          進捗はこの端末のブラウザ内にのみ保存されます。端末間では同期されず、
          iOS Safari では長く使わないと消えることがあるため、ときどき書き出しておくと安心です。
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={download}
            className="flex-1 rounded-xl border border-ink-400/25 py-2 text-xs font-semibold text-ink-600 active:scale-95"
          >
            書き出す
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 rounded-xl border border-ink-400/25 py-2 text-xs font-semibold text-ink-600 active:scale-95"
          >
            読み込む
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
        {importMsg && <p className="mt-2 text-xs text-ink-600">{importMsg}</p>}

        <button
          type="button"
          onClick={() => {
            if (!confirm("学習データをすべて消去します。よろしいですか？")) return;
            resetProgress();
            setProgress(emptyProgress());
          }}
          className="mt-3 w-full rounded-xl border border-bad/30 py-2 text-xs font-semibold text-bad active:scale-95"
        >
          学習データを消去する
        </button>
      </section>

      <p className="px-1 text-center text-[10px] text-ink-400">
        AI講師：{aiEnabled === null ? "確認中…" : aiEnabled ? "有効" : "モックモード"}
        ・復習待ち {dueReviewCount(progress)} 件
      </p>
    </Screen>
  );
}
