/**
 * Checks on the parts of sign-in that are load-bearing for security:
 * that anonymous requests cannot reach anything, that the allow-list fails
 * closed, that the OAuth state parameter is enforced, and that a valid session
 * cookie cannot be used from another origin.
 *
 * Run with `npm test`. No network and no database are involved.
 */
import { Hono } from "hono";

process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-secret";
process.env.SESSION_SECRET = "s".repeat(48);
process.env.ALLOWED_EMAILS = "Allowed@Example.com , second@example.com";
process.env.APP_URL = "https://aitalk.example.com";
delete process.env.DATABASE_URL;
delete process.env.ANTHROPIC_API_KEY;

const { createApiApp } = await import("./app");
const { issueSession } = await import("./session");
const { resolveConfig, isAllowedEmail } = await import("./env");

const app = createApiApp();
const origin = "https://aitalk.example.com";

/**
 * Requests are made against the absolute origin rather than a bare path so that
 * `new URL(req.url).origin` matches the Origin header, exactly as it does in
 * production where the SPA and the API are served from the same host. With a
 * bare path Hono synthesises `http://localhost` and every same-origin check
 * would fail for the wrong reason.
 */
const at = (path: string) => `${origin}${path}`;
let fails = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
  if (!ok) fails++;
};

// --- nothing is reachable without a session ---------------------------------
const guarded = [
  ["POST", "/api/tutor"],
  ["POST", "/api/coach"],
  ["GET", "/api/progress"],
  ["PUT", "/api/progress"],
] as const;
for (const [method, path] of guarded) {
  const res = await app.request(at(path), {
    method,
    headers: { "content-type": "application/json", origin },
    body: method === "GET" ? undefined : "{}",
  });
  check(`${method} ${path} rejects anonymous`, res.status === 401, `(${res.status})`);
}
check("GET /api/health stays open", (await app.request(at("/api/health"), { headers: { origin } })).status === 200);
check("GET /api/auth/me reports signed out", (await app.request(at("/api/auth/me"), { headers: { origin } })).status === 401);

// --- the allow-list is the only gate, so it must fail closed ----------------
const cfg = resolveConfig();
check("allow-list ignores case", isAllowedEmail(cfg, "ALLOWED@EXAMPLE.COM"));
check("allow-list ignores surrounding spaces", isAllowedEmail(cfg, "  second@example.com "));
check("allow-list rejects an outsider", !isAllowedEmail(cfg, "attacker@example.com"));
check("allow-list rejects a missing address", !isAllowedEmail(cfg, undefined));
check(
  "an empty allow-list means nobody, not everybody",
  !isAllowedEmail(resolveConfig({ ...process.env, ALLOWED_EMAILS: "" }), "anyone@example.com"),
);

// --- starting the OAuth flow ------------------------------------------------
const start = await app.request(at("/api/auth/google"), { headers: { origin } });
const loc = new URL(start.headers.get("location") ?? "https://invalid.example");
check("/api/auth/google redirects to Google", start.status === 302 && loc.host === "accounts.google.com");
check("  only identity scopes are requested", loc.searchParams.get("scope") === "openid email profile");
check("  redirect_uri is derived from APP_URL", loc.searchParams.get("redirect_uri") === `${origin}/api/auth/callback`);
const state = loc.searchParams.get("state") ?? "";
check("  a state parameter is issued", state.length > 0);
const stateCookie = start.headers.get("set-cookie") ?? "";
check("  state is kept in an HttpOnly cookie", stateCookie.includes("aitalk_oauth_state") && stateCookie.includes("HttpOnly"));

// --- the callback must not accept an unverified state -----------------------
check(
  "callback rejects a missing state",
  (await app.request(at("/api/auth/callback?code=abc"), { headers: { origin } })).status === 403,
);
check(
  "callback rejects a mismatched state (authorization-code CSRF)",
  (
    await app.request(at("/api/auth/callback?code=abc&state=forged"), {
      headers: { origin, cookie: `aitalk_oauth_state=${state}` },
    })
  ).status === 403,
);

// --- a real session unlocks the API ----------------------------------------
const issuer = new Hono();
issuer.get("/login-as", async (c) => {
  await issueSession(c, resolveConfig(), {
    id: "google-sub-1",
    email: "allowed@example.com",
    name: "Test User",
    picture: null,
  });
  return c.json({ ok: true });
});
const setCookie = (await issuer.request("/login-as")).headers.get("set-cookie") ?? "";
check("session cookie is HttpOnly", setCookie.includes("HttpOnly"));
check("session cookie is Secure over https", setCookie.includes("Secure"));
check("session cookie is SameSite=Lax", setCookie.includes("SameSite=Lax"));
const cookie = setCookie.split(";")[0] ?? "";

check("a valid session identifies the user", (await app.request(at("/api/auth/me"), { headers: { origin, cookie } })).status === 200);
check(
  "a valid session reaches the tutor",
  (
    await app.request(at("/api/tutor"), {
      method: "POST",
      headers: { "content-type": "application/json", origin, cookie },
      body: JSON.stringify({ mode: "freetalk", level: "beginner", history: [], userText: "Yesterday I go to the park" }),
    })
  ).status === 200,
);
check(
  "a tampered session cookie is rejected",
  (await app.request(at("/api/auth/me"), { headers: { origin, cookie: cookie.slice(0, -3) + "xyz" } })).status === 401,
);

// --- another site must not be able to drive the API with the user's cookie ---
//
// The realistic attack is an HTML form posted from another site, because a form
// can send a request cross-origin without a CORS preflight. It cannot set
// `application/json`, but it can send `text/plain`, and Hono's `c.req.json()`
// would happily parse that body. `csrf()` is what closes it.
//
// A cross-origin `application/json` request is not tested here because it is not
// the server that stops it: the browser requires a preflight for that content
// type, and this app returns no CORS headers, so the request never arrives.
const formAttack = await app.request(at("/api/tutor"), {
  method: "POST",
  headers: { "content-type": "text/plain", origin: "https://evil.example.com", cookie },
  body: JSON.stringify({ mode: "freetalk", level: "beginner", history: [], userText: "hi" }),
});
check("cross-origin form POST is blocked despite a valid cookie", formAttack.status === 403, `(${formAttack.status})`);

const sameOriginForm = await app.request(at("/api/tutor"), {
  method: "POST",
  headers: { "content-type": "text/plain", origin, cookie },
  body: JSON.stringify({ mode: "freetalk", level: "beginner", history: [], userText: "hi" }),
});
check("same-origin requests are unaffected by the CSRF check", sameOriginForm.status === 200, `(${sameOriginForm.status})`);

console.log(fails === 0 ? "\nall auth checks pass" : `\n${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
