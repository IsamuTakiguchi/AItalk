import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createApiApp } from "./app";
import { loginConfigured, resolveConfig } from "./env";

/** Node entry, used both by `npm run dev:api` and by Railway in production. */
const root = new Hono();

root.route("/", createApiApp());

// Order matters: API first, then built assets, then the SPA fallback so deep
// links like /courses/travel return index.html instead of 404.
root.use("/*", serveStatic({ root: "./dist" }));
root.get("*", serveStatic({ path: "./dist/index.html" }));

// Railway injects PORT; binding is left to Node, which listens on all
// interfaces — binding to localhost would make the app unreachable in a container.
const port = Number(process.env.PORT ?? 3000);
serve({ fetch: root.fetch, port });
console.log(`[aitalk] listening on port ${port} (all interfaces)`);
const cfg = resolveConfig();
console.log(
  cfg.isMock
    ? "[aitalk] No ANTHROPIC_API_KEY — running in mock mode."
    : "[aitalk] ANTHROPIC_API_KEY found — AI tutor enabled.",
);
console.log(
  loginConfigured(cfg)
    ? `[aitalk] Google sign-in enabled for ${cfg.allowedEmails.length} allowed address(es).`
    : "[aitalk] Google sign-in NOT configured — set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and SESSION_SECRET.",
);
if (loginConfigured(cfg) && cfg.allowedEmails.length === 0) {
  console.warn("[aitalk] ALLOWED_EMAILS is empty — nobody will be able to sign in.");
}
if (!cfg.databaseUrl) {
  console.warn("[aitalk] No DATABASE_URL — progress will not be saved to the server.");
}
