type Bucket = { count: number; resetAt: number };

/**
 * Best-effort in-memory rate limiter. Serverless instances each keep their
 * own map, so this throttles a flood rather than enforcing a global quota —
 * enough to stop the form being used as an email relay. Swap for a shared
 * store (Redis/Upstash) if traffic ever justifies it.
 */
const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 5_000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

function prune(now: number) {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
  // Still oversized after pruning (sustained attack): drop the oldest keys.
  if (buckets.size >= MAX_TRACKED_KEYS) {
    const overflow = buckets.size - MAX_TRACKED_KEYS + 1;
    let removed = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (++removed >= overflow) break;
    }
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    if (buckets.size >= MAX_TRACKED_KEYS) prune(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;

  if (bucket.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

/** Test seam — the limiter is module state, so tests need a way to reset it. */
export function resetRateLimits() {
  buckets.clear();
}

export function clientIpFrom(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("x-nf-client-connection-ip") ??
    "unknown"
  );
}
