// A tiny in-memory sliding-window rate limiter. Suitable for a single-instance
// deployment (state is per-process; swap for a shared store if scaled out).

export interface RateLimiter {
  /** Records a hit for `key` and returns whether it is within the limit. */
  check(key: string, now?: number): boolean;
  /** Clears all buckets (used in tests). */
  reset(): void;
}

export function createRateLimiter({
  limit,
  windowMs,
}: {
  limit: number;
  windowMs: number;
}): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    check(key, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
    reset() {
      hits.clear();
    },
  };
}

// Public newsletter signup: cap confirmation emails per client IP to blunt
// spam / Resend-cost amplification. Shared singleton so all requests to the
// route share the same buckets.
export const NEWSLETTER_SIGNUP_LIMIT = 5;
export const NEWSLETTER_SIGNUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour
export const newsletterSignupLimiter = createRateLimiter({
  limit: NEWSLETTER_SIGNUP_LIMIT,
  windowMs: NEWSLETTER_SIGNUP_WINDOW_MS,
});
