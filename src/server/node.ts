import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createApiApp } from "./app";

/**
 * Node entry, used both by `npm run dev:api` and by Railway in production.
 *
 * Note the env reader ignores the context: `@hono/node-server` sets `c.env` to
 * `{ incoming, outgoing }`, so secrets come from `process.env` here.
 */
const root = new Hono();

root.route("/", createApiApp(() => process.env));

// Order matters: API first, then built assets, then the SPA fallback so deep
// links like /courses/travel return index.html instead of 404.
root.use("/*", serveStatic({ root: "./dist" }));
root.get("*", serveStatic({ path: "./dist/index.html" }));

// Railway injects PORT; binding is left to Node, which listens on all
// interfaces — binding to localhost would make the app unreachable in a container.
const port = Number(process.env.PORT ?? 3000);
serve({ fetch: root.fetch, port });
console.log(`[aitalk] listening on port ${port} (all interfaces)`);
console.log(
  process.env.ANTHROPIC_API_KEY?.trim()
    ? "[aitalk] ANTHROPIC_API_KEY found — AI tutor enabled."
    : "[aitalk] No ANTHROPIC_API_KEY — running in mock mode.",
);
