import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { sign, verify } from "hono/jwt";
import type { AppConfig, Vars } from "./env";

/** Stated explicitly on both sides so a default change cannot silently weaken it. */
const ALG = "HS256" as const;

export const SESSION_COOKIE = "aitalk_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
};

type SessionClaims = SessionUser & { exp: number };

export type AuthVars = Vars & { user: SessionUser };

/**
 * Cookie attributes for the session.
 *
 * `SameSite=Lax` is the important one: it still sends the cookie on the
 * top-level GET navigation that Google redirects back to, so the OAuth callback
 * works, while withholding it from cross-site POSTs. `Secure` is dropped on
 * plain-HTTP localhost because the browser would otherwise refuse to store it
 * during local development.
 */
function cookieOptions(config: AppConfig) {
  return {
    httpOnly: true,
    secure: config.appUrl.startsWith("https://"),
    sameSite: "Lax" as const,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export async function issueSession(
  c: Context,
  config: AppConfig,
  user: SessionUser,
): Promise<void> {
  if (!config.sessionSecret) throw new Error("SESSION_SECRET is not configured");
  const claims: SessionClaims = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 24 * 60 * 60,
  };
  const token = await sign(claims, config.sessionSecret, ALG);
  setCookie(c, SESSION_COOKIE, token, cookieOptions(config));
}

export function clearSession(c: Context, config: AppConfig): void {
  deleteCookie(c, SESSION_COOKIE, { ...cookieOptions(config), maxAge: undefined });
}

/** Returns the signed-in user, or null. Never throws on a malformed cookie. */
export async function readSession(
  c: Context,
  config: AppConfig,
): Promise<SessionUser | null> {
  if (!config.sessionSecret) return null;
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return null;
  try {
    const claims = (await verify(token, config.sessionSecret, ALG)) as unknown as SessionClaims;
    if (!claims?.id || !claims.email) return null;
    return { id: claims.id, email: claims.email, name: claims.name, picture: claims.picture };
  } catch {
    // Expired, tampered with, or signed by a rotated secret — all mean "logged out".
    return null;
  }
}

/**
 * Gate for every route that touches the learner's data or spends API budget.
 * The app requires login, so this is the default rather than the exception.
 */
export const requireAuth: MiddlewareHandler<{ Variables: AuthVars }> = async (c, next) => {
  const user = await readSession(c, c.var.config);
  if (!user) {
    return c.json({ code: "unauthenticated", messageJa: "ログインしてください。" }, 401);
  }
  c.set("user", user);
  await next();
};
