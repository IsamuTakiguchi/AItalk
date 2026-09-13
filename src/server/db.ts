import postgres from "postgres";
import type { AppConfig } from "./env";

/**
 * Postgres access.
 *
 * The pool is a lazily created module singleton: Railway runs one process, and
 * opening a pool per request would exhaust the database's connection limit.
 * `max` is deliberately small for the same reason — this app is chatty with
 * Claude, not with Postgres.
 */
let sql: postgres.Sql | null = null;
let migrated: Promise<void> | null = null;

export function getSql(config: AppConfig): postgres.Sql | null {
  if (!config.databaseUrl) return null;
  sql ??= postgres(config.databaseUrl, {
    max: 5,
    idle_timeout: 30,
    connect_timeout: 10,
    // Railway's private network terminates TLS itself; enabling it here fails.
    ssl: config.databaseUrl.includes("localhost") ? false : "prefer",
    // `create table if not exists` emits a notice on every boot after the first.
    // That one is expected and would only make real notices harder to spot.
    onnotice: (notice) => {
      if (notice.code !== "42P07") console.warn("[db]", notice.message);
    },
  });
  return sql;
}

/**
 * Schema creation, run once per process on first use.
 *
 * Plain `CREATE TABLE IF NOT EXISTS` rather than a migration tool: there are two
 * tables, the statements are idempotent, and a failed migration on boot would
 * take the whole service down for a deploy that only changed the frontend.
 */
export async function ensureSchema(db: postgres.Sql): Promise<void> {
  migrated ??= (async () => {
    await db`
      create table if not exists users (
        id            text primary key,
        email         text not null unique,
        name          text,
        picture       text,
        created_at    timestamptz not null default now(),
        last_seen_at  timestamptz not null default now()
      )
    `;
    await db`
      create table if not exists progress (
        user_id     text primary key references users(id) on delete cascade,
        data        jsonb not null,
        updated_at  timestamptz not null default now()
      )
    `;
  })();
  await migrated;
}

/** Resets the cached pool. Only used by tests. */
export async function closeDb(): Promise<void> {
  await sql?.end({ timeout: 5 });
  sql = null;
  migrated = null;
}
