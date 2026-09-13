import type { MiddlewareHandler } from "hono";
import type { Vars } from "./env";

/**
 * A deployment of this app is a proxy to a paid API key, so the AI routes are
 * rate limited and size capped even though sign-in is required — an allowed user
 * can still run up a bill, by accident or otherwise.
 *
 * The bucket is per-process and in-memory, which is sufficient because Railway
 * runs a single instance; it would need moving to the database if this were ever
 * scaled horizontally.
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

export const guard: MiddlewareHandler<{ Variables: Vars }> = async (c, next) => {
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
