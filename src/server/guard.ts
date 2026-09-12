import type { MiddlewareHandler } from "hono";
import type { Vars } from "./env";

/**
 * A public deployment of this app is a proxy to a paid API key, so the AI routes
 * are rate limited and size capped.
 *
 * Caveat worth knowing: on Workers this bucket lives in one isolate, so it is a
 * speed bump rather than a wall. Cloudflare's Rate Limiting binding is the real
 * fix for a properly public deploy; this is the portable default that also works
 * on Railway. `DEMO_PASSCODE` is the actual lock.
 */
const WINDOW_MS = 5 * 60_000;
const MAX_PER_WINDOW = 20;
const MAX_BODY_BYTES = 32 * 1024;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function sweep(now: number): void {
  if (buckets.size < 500) return;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

function clientKey(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip")
    ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown"
  );
}

/**
 * Passcode check only. Split out from the rate limiter so `/api/verify` can
 * validate a code without consuming request budget or touching the AI.
 */
export const passcodeGuard: MiddlewareHandler<{ Variables: Vars }> = async (c, next) => {
  const { demoPasscode } = c.var.config;
  if (demoPasscode && c.req.header("x-aitalk-pass") !== demoPasscode) {
    return c.json({ code: "unauthorized", messageJa: "アクセスコードが必要です。" }, 401);
  }
  await next();
};

export const guard: MiddlewareHandler<{ Variables: Vars }> = async (c, next) => {
  const { demoPasscode } = c.var.config;

  if (demoPasscode && c.req.header("x-aitalk-pass") !== demoPasscode) {
    return c.json({ code: "unauthorized", messageJa: "アクセスコードが必要です。" }, 401);
  }

  const declared = Number(c.req.header("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return c.json({ code: "too_large", messageJa: "送信内容が大きすぎます。" }, 413);
  }

  const now = Date.now();
  sweep(now);
  const key = clientKey(c.req.raw.headers);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
  } else if (bucket.count >= MAX_PER_WINDOW) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return c.json(
      { code: "rate_limited", messageJa: "リクエストが多すぎます。少し待ってからお試しください。" },
      429,
      { "retry-after": String(retryAfter) },
    );
  } else {
    bucket.count += 1;
  }

  await next();
};
