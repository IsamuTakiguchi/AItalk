import { Hono } from "hono";
import { resolveConfig, type ReadEnv, type Vars } from "./env";
import { guard, passcodeGuard } from "./guard";
import { AiError, runCoachNote, runTutorTurn } from "./claude";
import { mockCoachNote, mockTutorTurn } from "./mock";
import { CoachRequestSchema, TutorRequestSchema, type HealthResponse } from "./schemas";

/**
 * The API, shared verbatim by both deploy targets. Deliberately free of any
 * platform-specific access: no `process`, no `fs`, no asset serving. The only
 * environment access is through the injected `readEnv`.
 *
 * There is no CORS middleware on purpose — dev goes through Vite's proxy and
 * production is same-origin, so a permissive policy would only let other sites
 * drive the API key.
 */
export function createApiApp(readEnv: ReadEnv) {
  const app = new Hono<{ Variables: Vars }>().basePath("/api");

  app.use("*", async (c, next) => {
    c.set("config", resolveConfig(readEnv(c)));
    await next();
  });

  app.get("/health", (c) => {
    const body: HealthResponse = {
      ok: true,
      aiEnabled: !c.var.config.isMock,
      passcodeRequired: Boolean(c.var.config.demoPasscode),
    };
    return c.json(body);
  });

  // Cheap passcode check: lets the client validate an access code without
  // spending an AI request or rate-limit budget on it.
  app.get("/verify", passcodeGuard, (c) => c.json({ ok: true }));

  app.post("/tutor", guard, async (c) => {
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

  app.post("/coach", guard, async (c) => {
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
