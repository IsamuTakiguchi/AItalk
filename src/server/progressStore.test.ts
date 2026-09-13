/**
 * Exercises the progress store against a real Postgres.
 *
 * Skipped automatically when TEST_DATABASE_URL is not set, so `npm test` stays
 * runnable without a database. The concurrency case is the reason this exists:
 * the merge being correct in isolation says nothing about whether two
 * simultaneous saves can still clobber each other through the store.
 */
import { emptyProgress, type Progress } from "../lib/progress";
import { closeDb, ensureSchema, getSql } from "./db";
import { resolveConfig } from "./env";
import { readProgress, writeProgress } from "./progressStore";

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.log("SKIP  progressStore: set TEST_DATABASE_URL to run these");
  process.exit(0);
}

const config = resolveConfig({ ...process.env, DATABASE_URL: url });
let fails = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
  if (!ok) fails++;
};

const db = getSql(config)!;
await ensureSchema(db);
await db`delete from users where id like 'test-%'`;
const testUser = { id: "test-user", email: "test@example.com", name: null, picture: null };

const withXp = (total: number, day: string, lessonId: string): Progress => ({
  ...emptyProgress(),
  xp: { total, byDay: { [day]: total } },
  lessons: { [lessonId]: { completedAt: `2026-09-${day.slice(-2)}T00:00:00.000Z`, attempts: 1, bestScore: total } },
  stats: { utterances: total, talkTurns: 0, sessions: 1 },
});

// --- schema is idempotent ---------------------------------------------------
await ensureSchema(db);
check("ensureSchema can run twice", true);

// --- a write with no pre-existing user row must succeed ---------------------
// progress.user_id is a foreign key, and a 30-day session can outlive the row it
// points at. The store re-asserts the user rather than failing every save.
const noUserRow = await db`select count(*)::int as n from users where id = 'test-user'`;
check("the user row does not exist yet", noUserRow[0]!.n === 0);

// --- first write, then read back --------------------------------------------
const first = withXp(100, "2026-09-12", "lesson-a");
await writeProgress(config, testUser, first);
const readBack = await readProgress(config, "test-user");
check("a save creates the missing user row instead of failing", readBack?.xp.total === 100);
const healed = await db`select email from users where id = 'test-user'`;
check("  and rebuilds it from the signed session claims", healed[0]?.email === "test@example.com");

// --- a second device's work is merged, not overwritten ----------------------
const second = withXp(60, "2026-09-13", "lesson-b");
await writeProgress(config, testUser, second);
const merged = await readProgress(config, "test-user");
check("a lower total does not overwrite a higher one", merged?.xp.total === 100);
check("both devices' days survive", Object.keys(merged?.xp.byDay ?? {}).length === 2);
check("both devices' lessons survive", Object.keys(merged?.lessons ?? {}).length === 2);

// --- the case row-level locking exists for ----------------------------------
// Ten saves fired at once, each unaware of the others. Without `for update` in
// the transaction they would each read the same base and the last writer would
// win, losing nine lessons.
await db`delete from progress where user_id = 'test-user'`;
await Promise.all(
  Array.from({ length: 10 }, (_, i) =>
    writeProgress(config, testUser, withXp(10 * (i + 1), `2026-10-${String(i + 1).padStart(2, "0")}`, `lesson-${i}`)),
  ),
);
const concurrent = await readProgress(config, "test-user");
check("10 concurrent saves all land", Object.keys(concurrent?.lessons ?? {}).length === 10,
  `(${Object.keys(concurrent?.lessons ?? {}).length}/10 lessons)`);
check("concurrent saves keep the highest total", concurrent?.xp.total === 100);
check("concurrent saves keep every day", Object.keys(concurrent?.xp.byDay ?? {}).length === 10);

// --- replace mode is the one way to go backwards ----------------------------
await writeProgress(config, testUser, emptyProgress(), "replace");
const cleared = await readProgress(config, "test-user");
check("replace mode clears the data", cleared?.xp.total === 0 && Object.keys(cleared?.lessons ?? {}).length === 0);

// --- a user with nothing stored ---------------------------------------------
check("a user with no row reads as null", (await readProgress(config, "test-nobody")) === null);

await db`delete from users where id like 'test-%'`;
await closeDb();
console.log(fails === 0 ? "\nall progress store checks pass" : `\n${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
