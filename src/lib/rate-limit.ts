/**
 * Small fixed-window rate limiter for the unauthenticated write endpoints
 * (audit H4: login, forgot-password, join, signup, leads and drop-in had no
 * limit of any kind).
 *
 * Scope and honesty: the counters live in the memory of one function instance,
 * so on Vercel the effective limit is "per client per warm instance". That
 * stops a single client hammering a route from one region; it is not a global
 * guarantee. Vercel Firewall rate-limit rules on the same paths are the
 * durable layer (see the Phase 0 rollout record); this limiter stays as
 * defence in depth and works in local and preview builds too.
 */

export interface RateLimitRule {
  id: string;
  limit: number;
  windowMs: number;
  /** Count each matching path separately (true) or share one bucket per rule. */
  perPath: boolean;
  match: (pathname: string) => boolean;
}

const MINUTE = 60_000;

// First match wins, so the tighter forgot-password rule precedes /api/auth/*.
export const RATE_LIMIT_RULES: RateLimitRule[] = [
  { id: "forgot-password", limit: 5, windowMs: 15 * MINUTE, perPath: false, match: (p) => p === "/api/auth/forgot-password" },
  { id: "auth", limit: 30, windowMs: MINUTE, perPath: true, match: (p) => p.startsWith("/api/auth/") },
  { id: "leads", limit: 20, windowMs: MINUTE, perPath: false, match: (p) => p === "/api/leads" || p.startsWith("/api/leads/") },
  { id: "dropin", limit: 20, windowMs: MINUTE, perPath: false, match: (p) => p.startsWith("/api/dropin/") },
];

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MAX_BUCKETS = 10_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

/** The client address as Vercel reports it (first x-forwarded-for hop). */
export function clientKey(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

function prune(now: number) {
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  // Still full (a flood of distinct addresses): drop the oldest entries.
  if (buckets.size >= MAX_BUCKETS) {
    const excess = buckets.size - MAX_BUCKETS + Math.ceil(MAX_BUCKETS / 10);
    let i = 0;
    for (const k of buckets.keys()) {
      if (i++ >= excess) break;
      buckets.delete(k);
    }
  }
}

/** Returns null when the request is not subject to any rule. */
export function checkRateLimit(method: string, pathname: string, client: string, now = Date.now()): RateLimitDecision | null {
  if (READ_METHODS.has(method.toUpperCase())) return null;
  const rule = RATE_LIMIT_RULES.find((r) => r.match(pathname));
  if (!rule) return null;

  const key = `${rule.id}|${rule.perPath ? pathname : "*"}|${client}`;
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) prune(now);
    bucket = { count: 0, resetAt: now + rule.windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return {
    allowed: bucket.count <= rule.limit,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - bucket.count),
    retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}
