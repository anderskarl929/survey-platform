/**
 * Simple in-memory rate limiter. Tracks request counts per key within a
 * sliding window.
 *
 * IMPORTANT: This is process-local state and is NOT shared between function
 * invocations on serverless platforms (Vercel, Netlify, etc). On serverless
 * each cold start gets a fresh empty Map and setInterval never fires, so
 * rate limits become effectively unenforced.
 *
 * This app is intended to run on a long-lived Node host (Railway, Render,
 * Fly.io, self-hosted). If you deploy to serverless, replace this with
 * Upstash Redis / Vercel KV / similar shared store BEFORE enabling public
 * access - a warning is logged at startup to remind you.
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

const isServerless = Boolean(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
if (isServerless) {
  console.warn(
    "[rate-limit] Körs i serverless-miljö - in-memory rate limit fungerar " +
    "inte mellan funktionsanrop. Byt till en delad store (Upstash/Vercel KV) " +
    "innan appen exponeras publikt."
  );
}

// Clean up expired entries periodically (no-op on serverless where the
// interval never fires anyway)
if (!isServerless) {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 60_000);
}

export function rateLimit(
  key: string,
  { maxRequests = 10, windowMs = 60_000 } = {}
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  return { allowed: true, retryAfterMs: 0 };
}
