import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { AiError, runCoachNote, runTutorTurn } from "./claude";
import { authRoutes } from "./auth";
import { loginConfigured, resolveConfig } from "./env";
import { guard } from "./guard";
import { mockCoachNote, mockTutorTurn } from "./mock";
import { readProgress, writeProgress } from "./progressStore";
import {
  CoachRequestSchema,
  ProgressSchema,
  TutorRequestSchema,
  type HealthResponse,
} from "./schemas";
import { requireAuth, type AuthVars } from "./session";

/**
 * The API.
 *
 * Sign-in is required for everything that reads the learner's data or spends API
 * budget; only `/api/health` and the auth routes themselves are open.
 *
 * There is no CORS middleware on purpose — dev goes through Vite's proxy and
 * production is same-origin, so a permissive policy would only let other sites
 * drive the API key using a logged-in user's cookie.
 */
export function createApiApp() {
  const app = new Hono<{ Variables: AuthVars }>().basePath("/api");

  app.use("*", async (c, next) => {
    c.set("config", resolveConfig());
    await next();
  });

  // Defence in depth alongside SameSite=Lax: rejects state-changing requests
  // whose Origin does not match this host.
  app.use("*", csrf());

  app.get("/health", (c) => {
    const body: HealthResponse = {
      ok: true,
      aiEnabled: !c.var.config.isMock,
      loginConfigured: loginConfigured(c.var.config),
    };
    return c.json(body);
  });

  app.route("/auth", authRoutes() as unknown as Hono<{ Variables: AuthVars }>);

  // --- learner data -------------------------------------------------------

  app.get("/progress", requireAuth, async (c) => {
    const data = await readProgress(c.var.config, c.var.user.id);
    return c.json({ progress: data });
  });

  app.put("/progress", requireAuth, async (c) => {
    const parsed = ProgressSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ code: "bad_request", messageJa: "保存内容の形式が正しくありません。" }, 400);
    }
    const mode = c.req.query("mode") === "replace" ? "replace" : "merge";
    const saved = await writeProgress(c.var.config, c.var.user, parsed.data, mode);
    return c.json({ progress: saved });
  });

  // --- AI -----------------------------------------------------------------

  app.post("/tutor", requireAuth, guard, async (c) => {
    const parsed = TutorRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ code: "bad_request", messageJa: "リクエストの形式が正しくありません。" }, 400);
    }
    const { anthropicApiKey } = c.var.config;
    if (!anthropicApiKey) return c.json(mockTutorTurn(parsed.data));

    try {
      return c.json(await runTutorTurn(parsed.data, anthropicApiKey));
    } catch (err) {
      // A rejected key is a misconfiguration, not a learner-facing dead end:
      // keep the session usable on mock output rather than failing the turn.
      if (err instanceof AiError && err.code === "bad_credentials") {
        return c.json(mockTutorTurn(parsed.data));
      }
      if (err instanceof AiError) {
        return c.json({ code: err.code, messageJa: err.messageJa }, err.status as 400);
      }
      throw err;
    }
  });

  app.post("/coach", requireAuth, guard, async (c) => {
    const parsed = CoachRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ code: "bad_request", messageJa: "リクエストの形式が正しくありません。" }, 400);
    }
    const { anthropicApiKey } = c.var.config;
    if (!anthropicApiKey) return c.json(mockCoachNote(parsed.data));

    try {
      return c.json(await runCoachNote(parsed.data, anthropicApiKey));
    } catch (err) {
      if (err instanceof AiError && err.code === "bad_credentials") {
        return c.json(mockCoachNote(parsed.data));
      }
      if (err instanceof AiError) {
        return c.json({ code: err.code, messageJa: err.messageJa }, err.status as 400);
      }
      throw err;
    }
  });

  return app;
}
