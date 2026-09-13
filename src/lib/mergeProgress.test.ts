import { mergeProgress } from "./mergeProgress";
import { emptyProgress, type Progress } from "./progress";

const norm = (v: any): any => {
  if (Array.isArray(v)) return v.map(norm).sort((x, y) => (JSON.stringify(x) < JSON.stringify(y) ? -1 : 1));
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, norm(v[k])]));
  return v;
};
const eq = (a: unknown, b: unknown) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
let fails = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) fails++;
};

// Device A: did a lesson today, one review item, failed it once.
const a: Progress = {
  ...emptyProgress(),
  createdAt: "2026-09-01T00:00:00.000Z",
  settings: { dailyGoalXp: 50, voiceUri: "A-voice", speechRate: 0.9, jaHintsVisible: true },
  streak: { current: 3, longest: 3, lastActiveDay: "2026-09-12", lastTzOffsetMin: -540 },
  xp: { total: 120, byDay: { "2026-09-11": 50, "2026-09-12": 70 } },
  lessons: { "basics-intro-phrase": { completedAt: "2026-09-12T01:00:00.000Z", attempts: 2, bestScore: 86 } },
  reviewItems: [{ id: "correction:i agree", kind: "correction", en: "I agree", ja: "…", box: 1, dueOn: "2026-09-13", addedAt: "2026-09-12T01:00:00.000Z", timesWrong: 1 }],
  stats: { utterances: 10, talkTurns: 4, sessions: 2 },
};

// Device B: different day, same review item further along, extra lesson.
const b: Progress = {
  ...emptyProgress(),
  createdAt: "2026-09-05T00:00:00.000Z",
  settings: { dailyGoalXp: 100, voiceUri: "B-voice", speechRate: 1.1, jaHintsVisible: false },
  streak: { current: 5, longest: 6, lastActiveDay: "2026-09-13", lastTzOffsetMin: -540 },
  xp: { total: 200, byDay: { "2026-09-12": 40, "2026-09-13": 80 } },
  lessons: { "basics-shop-phrase": { completedAt: "2026-09-13T01:00:00.000Z", attempts: 1, bestScore: 70 } },
  reviewItems: [{ id: "correction:i agree", kind: "correction", en: "I agree", ja: "…", box: 3, dueOn: "2026-09-20", addedAt: "2026-09-12T02:00:00.000Z", timesWrong: 4 }],
  stats: { utterances: 3, talkTurns: 9, sessions: 5 },
};

const ab = mergeProgress(a, b);
const ba = mergeProgress(b, a);

check("idempotent: merge(a,a) === a", eq(mergeProgress(a, a), a));
check("idempotent: merge(merge(a,b), b) === merge(a,b)", eq(mergeProgress(ab, b), ab));
// settings is order-dependent by design, so compare everything else.
const strip = (p: Progress) => ({ ...p, settings: null });
check("commutative (excluding settings)", eq(strip(ab), strip(ba)));

check("xp.total takes max, never sums", ab.xp.total === 200);
check("xp.byDay merges per day, max wins", eq(ab.xp.byDay, { "2026-09-11": 50, "2026-09-12": 70, "2026-09-13": 80 }));
check("streak keeps the best of both", ab.streak.current === 5 && ab.streak.longest === 6);
check("streak.lastActiveDay takes the later", ab.streak.lastActiveDay === "2026-09-13");
check("both devices' lessons survive", Object.keys(ab.lessons).length === 2);
check("createdAt keeps the earlier", ab.createdAt === "2026-09-01T00:00:00.000Z");
check("stats take max per field", ab.stats.utterances === 10 && ab.stats.talkTurns === 9 && ab.stats.sessions === 5);

check("review items de-duplicate by id", ab.reviewItems.length === 1);
check("review item keeps the higher box", ab.reviewItems[0]!.box === 3);
check("review item keeps the higher timesWrong", ab.reviewItems[0]!.timesWrong === 4);
check("settings: incoming wins", ab.settings.dailyGoalXp === 100 && ab.settings.jaHintsVisible === false);

// Replay attack shape: sending the same payload repeatedly must not inflate XP.
let replayed = a;
for (let i = 0; i < 5; i++) replayed = mergeProgress(replayed, a);
check("replaying a write 5x does not inflate XP", replayed.xp.total === 120);

// A fresh account merging in a device's history keeps all of it.
check("empty base absorbs everything", mergeProgress(emptyProgress(), a).xp.total === 120);

const tzA: Progress = { ...a, streak: { ...a.streak, lastActiveDay: "2026-09-12", lastTzOffsetMin: -540 } };
const tzB: Progress = { ...b, streak: { ...b.streak, lastActiveDay: "2026-09-13", lastTzOffsetMin: 300 } };
check("timezone converges regardless of order",
  mergeProgress(tzA, tzB).streak.lastTzOffsetMin === mergeProgress(tzB, tzA).streak.lastTzOffsetMin);
check("timezone follows the most recent activity",
  mergeProgress(tzA, tzB).streak.lastTzOffsetMin === 300);

console.log(fails === 0 ? "\nall merge properties hold" : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
