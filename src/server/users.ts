import { ensureSchema, getSql } from "./db";
import type { AppConfig } from "./env";
import type { SessionUser } from "./session";

/**
 * Records the signed-in user.
 *
 * Keyed on Google's `sub`, not the email address: an email can be changed or
 * reassigned, while `sub` is stable for the life of the account. The email is
 * stored for display and for matching against the allow-list, and is updated on
 * every login so a changed address does not strand the row.
 */
export async function upsertUser(config: AppConfig, user: SessionUser): Promise<void> {
  const db = getSql(config);
  // Without a database the app still runs; progress simply stays on the device.
  if (!db) return;
  await ensureSchema(db);
  await db`
    insert into users (id, email, name, picture, last_seen_at)
    values (${user.id}, ${user.email}, ${user.name}, ${user.picture}, now())
    on conflict (id) do update set
      email        = excluded.email,
      name         = excluded.name,
      picture      = excluded.picture,
      last_seen_at = now()
  `;
}
