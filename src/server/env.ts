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
  /** Where Google must send the user back. Registered in the Google console. */
  redirectUri: string;

  databaseUrl?: string;
};

export type Vars = { config: AppConfig };

function clean(v: string | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

/**
 * The public origin.
 *
 * Railway injects RAILWAY_PUBLIC_DOMAIN (bare host, no protocol) once a domain
 * is generated, so APP_URL only has to be set for a custom domain or locally.
 * Deriving it removes the most likely way to break sign-in: an APP_URL that does
 * not exactly match the redirect URI registered with Google fails the whole
 * flow with `redirect_uri_mismatch`.
 */
function resolveAppUrl(raw: NodeJS.ProcessEnv, port: string): string {
  const explicit = clean(raw.APP_URL);
  if (explicit) return explicit.replace(/\/+$/, "");
  const railway = clean(raw.RAILWAY_PUBLIC_DOMAIN);
  if (railway) return `https://${railway.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return `http://localhost:${port}`;
}

export function resolveConfig(raw: NodeJS.ProcessEnv = process.env): AppConfig {
  const anthropicApiKey = clean(raw.ANTHROPIC_API_KEY);
  const port = raw.PORT ?? "3000";
  const appUrl = resolveAppUrl(raw, port);

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
    appUrl,
    redirectUri: `${appUrl}/api/auth/callback`,
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
