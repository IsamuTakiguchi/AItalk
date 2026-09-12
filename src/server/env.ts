/**
 * Environment plumbing.
 *
 * The two deploy targets expose env differently and there is no safe way to read
 * both from one expression:
 *   - Cloudflare Workers puts secrets on `c.env`.
 *   - `@hono/node-server` sets `c.env` to `{ incoming, outgoing }` — the secrets
 *     are on `process.env` instead.
 * So each entrypoint injects its own reader and the shared app never sniffs the
 * platform.
 */
export type RawEnv = Record<string, string | undefined>;

/** Reads the raw environment for the current request. Supplied per platform. */
export type ReadEnv = (c: { env?: unknown }) => RawEnv;

export type AppConfig = {
  /** Absent => the app runs in mock mode. */
  anthropicApiKey?: string;
  /** When set, `x-aitalk-pass` must match it on AI routes. */
  demoPasscode?: string;
  isMock: boolean;
};

function clean(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

export function resolveConfig(raw: RawEnv): AppConfig {
  const anthropicApiKey = clean(raw.ANTHROPIC_API_KEY);
  return {
    anthropicApiKey,
    demoPasscode: clean(raw.DEMO_PASSCODE),
    isMock: !anthropicApiKey,
  };
}

/** Hono variable map, so `c.var.config` is typed in routes. */
export type Vars = { config: AppConfig };
