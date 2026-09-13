import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { isAllowedEmail, loginConfigured, type Vars } from "./env";
import { clearSession, issueSession, readSession } from "./session";
import { upsertUser } from "./users";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const STATE_COOKIE = "aitalk_oauth_state";

/** Profile fields Google returns in the ID token for the scopes we request. */
type GoogleClaims = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

/**
 * Decodes the ID token payload without verifying the signature.
 *
 * That is safe *here specifically*: the token came directly from Google's token
 * endpoint over TLS in response to our own authenticated request, so there is no
 * untrusted party in between to forge it. Signature verification is what you need
 * when a token arrives from the browser instead — which is exactly why this app
 * uses the server-side code flow rather than accepting a token from the client.
 */
function decodeIdToken(idToken: string): GoogleClaims | null {
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json) as GoogleClaims;
  } catch {
    return null;
  }
}

/** Renders a full-page message for failures that happen mid-redirect. */
function authError(messageJa: string, detailJa: string): Response {
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>ログインできません — AItalk</title>
<style>
  body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f6f7fb;
    font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;color:#0f172a}
  .card{max-width:22rem;margin:1rem;padding:1.75rem;background:#fff;border-radius:1rem;
    box-shadow:0 1px 3px rgba(0,0,0,.08);text-align:center}
  h1{font-size:1.05rem;margin:.75rem 0 .5rem}
  p{font-size:.8rem;line-height:1.7;color:#475569;margin:0 0 1.25rem}
  a{display:block;padding:.75rem;border-radius:.75rem;background:#4f46e5;color:#fff;
    text-decoration:none;font-size:.85rem;font-weight:600}
</style></head><body><div class="card">
<div style="font-size:2.5rem">🚫</div><h1>${messageJa}</h1><p>${detailJa}</p>
<a href="/">戻る</a></div></body></html>`;
  return new Response(html, { status: 403, headers: { "content-type": "text/html; charset=utf-8" } });
}

export function authRoutes() {
  const app = new Hono<{ Variables: Vars }>();

  app.get("/me", async (c) => {
    const user = await readSession(c, c.var.config);
    if (!user) return c.json({ code: "unauthenticated" }, 401);
    return c.json({ user });
  });

  app.get("/google", (c) => {
    const config = c.var.config;
    if (!loginConfigured(config)) {
      return c.json({ code: "login_unavailable", messageJa: "ログインが設定されていません。" }, 503);
    }

    // The state parameter is what stops an attacker from feeding us their own
    // authorization code; it is echoed back by Google and compared below.
    const state = crypto.randomUUID();
    setCookie(c, STATE_COOKIE, state, {
      httpOnly: true,
      secure: config.appUrl.startsWith("https://"),
      sameSite: "Lax",
      path: "/",
      maxAge: 600,
    });

    const url = new URL(AUTH_ENDPOINT);
    url.searchParams.set("client_id", config.googleClientId!);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    // Always show the picker so a shared device can switch accounts.
    url.searchParams.set("prompt", "select_account");
    return c.redirect(url.toString());
  });

  app.get("/callback", async (c) => {
    const config = c.var.config;
    if (!loginConfigured(config)) {
      return authError("ログインが設定されていません", "管理者に連絡してください。");
    }

    const expected = getCookie(c, STATE_COOKIE);
    deleteCookie(c, STATE_COOKIE, { path: "/" });
    const { code, state, error } = c.req.query();

    if (error) return authError("ログインが中断されました", "もう一度お試しください。");
    if (!code || !state || state !== expected) {
      return authError("ログインを検証できませんでした", "お手数ですが、最初からやり直してください。");
    }

    const res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.googleClientId!,
        client_secret: config.googleClientSecret!,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!res.ok) {
      return authError("Google と通信できませんでした", "時間をおいてもう一度お試しください。");
    }

    const { id_token } = (await res.json()) as { id_token?: string };
    const claims = id_token ? decodeIdToken(id_token) : null;
    if (!claims?.sub || !claims.email || claims.email_verified === false) {
      return authError("アカウント情報を取得できませんでした", "別のアカウントでお試しください。");
    }

    // Google applies no restriction of its own for these scopes, so this check is
    // the only thing limiting who can use the deployment.
    if (!isAllowedEmail(config, claims.email)) {
      return authError(
        "このアカウントは許可されていません",
        `${claims.email} はこのアプリの利用を許可されていません。管理者に連絡してください。`,
      );
    }

    const user = {
      id: claims.sub,
      email: claims.email,
      name: claims.name ?? null,
      picture: claims.picture ?? null,
    };
    await upsertUser(config, user);
    await issueSession(c, config, user);
    return c.redirect("/");
  });

  app.post("/logout", (c) => {
    clearSession(c, c.var.config);
    return c.json({ ok: true });
  });

  return app;
}
