import { createApiApp } from "./app";
import type { RawEnv } from "./env";

/**
 * Cloudflare Workers entry. Static assets and the SPA fallback are handled by the
 * platform via `[assets]` in wrangler.toml, so this only serves /api/*.
 */
export default createApiApp((c) => (c.env ?? {}) as RawEnv);
