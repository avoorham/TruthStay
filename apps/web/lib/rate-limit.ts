import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";

// ─── Shared rate limiters ─────────────────────────────────────────────────────
//
// Requires UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN env vars.
// If not configured (local dev without Redis), all limits pass through.

function createLimiter(requests: number, window: `${number} ${"s" | "m" | "h" | "d"}`) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    // No Redis configured — passthrough (dev mode)
    return null;
  }
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: false,
  });
}

// Expensive AI endpoints: 100 calls per hour per user
export const aiLimiter = createLimiter(100, "1 h");

// Content submission: 30 per hour per user
export const contentLimiter = createLimiter(30, "1 h");

/**
 * Check rate limit for a given key.
 * Returns a 429 NextResponse if rate-limited, otherwise null (allow).
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  key: string,
): Promise<NextResponse | null> {
  if (!limiter) return null;
  const { success } = await limiter.limit(key);
  if (!success) {
    return NextResponse.json(
      { error: "Rate limited — too many requests, please try again later" },
      { status: 429 },
    );
  }
  return null;
}
