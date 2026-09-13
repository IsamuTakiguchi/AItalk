import { mergeProgress } from "../lib/mergeProgress";
import type { Progress } from "../lib/progress";
import type postgres from "postgres";
import { ensureSchema, getSql } from "./db";
import type { AppConfig } from "./env";
import type { SessionUser } from "./session";

export async function readProgress(
  config: AppConfig,
  userId: string,
): Promise<Progress | null> {
  const db = getSql(config);
  if (!db) return null;
  await ensureSchema(db);
  const rows = await db<{ data: Progress }[]>`
    select data from progress where user_id = ${userId}
  `;
  return rows[0]?.data ?? null;
}

/**
 * Stores the learner's progress.
 *
 * `merge` mode is the default and what every ordinary save uses: the incoming
 * snapshot is merged into whatever is stored, so two devices saving at once
 * converge instead of overwriting each other. Because the merge takes the
 * maximum of every counter, a retried or out-of-order request is harmless.
 *
 * `replace` exists for the two operations merge cannot express — clearing the
 * data and importing a file — where the point is precisely to make values go
 * down.
 */
export async function writeProgress(
  config: AppConfig,
  user: SessionUser,
  incoming: Progress,
  mode: "merge" | "replace" = "merge",
): Promise<Progress | null> {
  const db = getSql(config);
  if (!db) return null;
  await ensureSchema(db);
  const userId = user.id;

  /**
   * Re-asserts the user row inside the same transaction as the write.
   *
   * `progress.user_id` is a foreign key, but a session cookie is valid for 30
   * days and the row it refers to can disappear in between — a restored backup,
   * a manually deleted account. Without this, such a user would get a 500 on
   * every save with no way to recover short of clearing their cookies. The
   * session is signed, so its claims are a trustworthy source to rebuild from.
   */
  const ensureUser = (tx: postgres.Sql | postgres.TransactionSql) => tx`
    insert into users (id, email, name, picture, last_seen_at)
    values (${userId}, ${user.email}, ${user.name}, ${user.picture}, now())
    on conflict (id) do update set last_seen_at = now()
  `;

  if (mode === "replace") {
    return db.begin(async (tx) => {
      await ensureUser(tx);
      await tx`
        insert into progress (user_id, data, updated_at)
        values (${userId}, ${tx.json(incoming as never)}, now())
        on conflict (user_id) do update set data = excluded.data, updated_at = now()
      `;
      return incoming;
    }) as Promise<Progress>;
  }

  // Read-modify-write inside a transaction, with the row locked so a concurrent
  // save cannot read the same base and merge over this one's result.
  return db.begin(async (tx) => {
    await ensureUser(tx);
    const rows = await tx<{ data: Progress }[]>`
      select data from progress where user_id = ${userId} for update
    `;
    const stored = rows[0]?.data;
    const merged = stored ? mergeProgress(stored, incoming) : incoming;
    await tx`
      insert into progress (user_id, data, updated_at)
      values (${userId}, ${tx.json(merged as never)}, now())
      on conflict (user_id) do update set data = excluded.data, updated_at = now()
    `;
    return merged;
  }) as Promise<Progress>;
}
