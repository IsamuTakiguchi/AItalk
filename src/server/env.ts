/**
 * Configuration, read once per request from the process environment.
 *
 * This used to abstract over Cloudflare Workers bindings and Node's `process.env`.
 * The app now targets Railway (Node) only, so it reads `process.env` directly.
 */
export type AppConfig = {
  /** Absent => the AI tutor falls back to canned mock responses. */
  anthropicApiKey?: string;
  isMock: boolean;

  /** Absent => auth routes report that login is unavailable rather than half-working. */
  googleClientId?: string;
  googleClientSecret?: string;
  /** Signs the session cookie. Absent => sessions cannot be issued. */
  sessionSecret?: string;
  /** Lower-cased allow-list. Empty => nobody can sign in (fail closed). */
  allowedEmails: string[];
  /** Public origin, used to build the OAuth redirect URI. */
  appUrl: string;

  databaseUrl?: string;
};

export type Vars = { config: AppConfig };

function clean(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

export function resolveConfig(raw: NodeJS.ProcessEnv = process.env): AppConfig {
  const anthropicApiKey = clean(raw.ANTHROPIC_API_KEY);
  const port = raw.PORT ?? "3000";

  return {
    anthropicApiKey,
    isMock: !anthropicApiKey,
    googleClientId: clean(raw.GOOGLE_CLIENT_ID),
    googleClientSecret: clean(raw.GOOGLE_CLIENT_SECRET),
    sessionSecret: clean(raw.SESSION_SECRET),
    allowedEmails: (clean(raw.ALLOWED_EMAILS) ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    appUrl: (clean(raw.APP_URL) ?? `http://localhost:${port}`).replace(/\/+$/, ""),
    databaseUrl: clean(raw.DATABASE_URL),
  };
}

/** True when Google sign-in is fully configured and can actually be offered. */
export function loginConfigured(c: AppConfig): boolean {
  return Boolean(c.googleClientId && c.googleClientSecret && c.sessionSecret);
}

/**
 * Google hands us any Google account — the scopes we request are non-sensitive,
 * so Google performs no verification and applies no restriction of its own. This
 * list is therefore the only thing standing between the deployment and the whole
 * internet, and an empty list must mean "nobody", never "everybody".
 */
export function isAllowedEmail(c: AppConfig, email: string | undefined): boolean {
  if (!email) return false;
  return c.allowedEmails.includes(email.trim().toLowerCase());
}
