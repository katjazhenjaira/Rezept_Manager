import type { Context, Next } from "hono";
import type { Env } from "../types";

const LIMIT = 10;
const TTL_SECONDS = 65;

export async function rateLimit(c: Context<{ Bindings: Env }>, next: Next) {
  const ip =
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown";

  const minute = Math.floor(Date.now() / 60_000);
  const key = `rate:${ip}:${minute}`;

  const raw = await c.env.RATE_LIMIT_KV.get(key);
  const count = raw ? parseInt(raw, 10) : 0;

  if (count >= LIMIT) {
    return c.json(
      { error: "Rate limit exceeded. Maximum 10 requests per minute." },
      429
    );
  }

  await c.env.RATE_LIMIT_KV.put(key, String(count + 1), {
    expirationTtl: TTL_SECONDS,
  });

  return next();
}
