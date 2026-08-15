import { createHash } from "node:crypto";
import { isIP } from "node:net";

type Bucket = {
  count: number;
  resetAt: number;
};

type SharedBackendConfig = {
  url: string;
  token: string;
  keyPrefix: string;
  timeoutMs: number;
};

const buckets = new Map<string, Bucket>();

const REDIS_FIXED_WINDOW_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return {count, ttl}
`;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "limit" | "unavailable"; retryAfterSeconds: number };

function positiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  return values.map((value) => value?.trim()).find((value): value is string => Boolean(value));
}

function sharedBackendConfig(): SharedBackendConfig | null | "invalid" {
  const url = firstNonEmpty(process.env.RATE_LIMIT_REDIS_REST_URL, process.env.UPSTASH_REDIS_REST_URL);
  const token = firstNonEmpty(process.env.RATE_LIMIT_REDIS_REST_TOKEN, process.env.UPSTASH_REDIS_REST_TOKEN);

  if (!url && !token) return null;
  if (!url || !token) return "invalid";

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "invalid";
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") return "invalid";
  } catch {
    return "invalid";
  }

  return {
    url: url.replace(/\/+$/, ""),
    token,
    keyPrefix: process.env.RATE_LIMIT_KEY_PREFIX?.trim() || "gymday:rate-limit",
    timeoutMs: positiveInteger(process.env.RATE_LIMIT_REDIS_TIMEOUT_MS, 1_500, 10_000),
  };
}

function allowsSingleInstanceMemoryBackend(): boolean {
  return process.env.RATE_LIMIT_BACKEND?.trim().toLowerCase() === "memory";
}

function storageKey(key: string, prefix = "memory"): string {
  const digest = createHash("sha256").update(key).digest("hex");
  return `${prefix}:${digest}`;
}

function cleanAndBoundMemoryStore(now: number, maximumBuckets: number): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }

  while (buckets.size >= maximumBuckets) {
    const oldestKey = buckets.keys().next().value as string | undefined;
    if (!oldestKey) break;
    buckets.delete(oldestKey);
  }
}

function consumeMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const maximumBuckets = positiveInteger(process.env.RATE_LIMIT_MEMORY_MAX_BUCKETS, 10_000, 100_000);
  const normalizedKey = storageKey(key);
  const bucket = buckets.get(normalizedKey);

  if (!bucket || now >= bucket.resetAt) {
    cleanAndBoundMemoryStore(now, maximumBuckets);
    buckets.set(normalizedKey, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      reason: "limit",
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)),
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

function numericResult(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

async function consumeShared(
  config: SharedBackendConfig,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        REDIS_FIXED_WINDOW_SCRIPT,
        "1",
        storageKey(key, config.keyPrefix),
        String(windowMs),
      ]),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return { allowed: false, reason: "unavailable", retryAfterSeconds: 60 };
    }

    const payload = (await response.json()) as { result?: unknown; error?: unknown };
    if (payload.error || !Array.isArray(payload.result) || payload.result.length < 2) {
      return { allowed: false, reason: "unavailable", retryAfterSeconds: 60 };
    }

    const count = numericResult(payload.result[0]);
    const ttlMs = numericResult(payload.result[1]);
    if (count === null || count < 1 || ttlMs === null) {
      return { allowed: false, reason: "unavailable", retryAfterSeconds: 60 };
    }

    if (count > limit) {
      return {
        allowed: false,
        reason: "limit",
        retryAfterSeconds: Math.max(1, Math.ceil(Math.max(ttlMs, 1) / 1_000)),
      };
    }

    return { allowed: true };
  } catch {
    return { allowed: false, reason: "unavailable", retryAfterSeconds: 60 };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Consumes one request from a fixed-window rate limit.
 *
 * Production deliberately fails closed when the shared REST Redis backend is
 * absent or unavailable unless a single-replica deployment explicitly selects
 * RATE_LIMIT_BACKEND=memory. Development and tests use the bounded memory store.
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs < 1) {
    throw new TypeError("Invalid rate-limit policy");
  }

  if (allowsSingleInstanceMemoryBackend()) {
    return consumeMemory(key, limit, windowMs);
  }

  const backend = sharedBackendConfig();
  if (backend && backend !== "invalid") {
    return consumeShared(backend, key, limit, windowMs);
  }

  if (
    backend === "invalid" || process.env.NODE_ENV === "production"
  ) {
    return { allowed: false, reason: "unavailable", retryAfterSeconds: 60 };
  }

  return consumeMemory(key, limit, windowMs);
}

function normalizeIpCandidate(value: string): string | null {
  let candidate = value.trim().replace(/^"|"$/g, "");
  if (!candidate || candidate.length > 64) return null;

  if (candidate.startsWith("[")) {
    const closingBracket = candidate.indexOf("]");
    if (closingBracket < 1) return null;
    candidate = candidate.slice(1, closingBracket);
  } else if (!isIP(candidate)) {
    const ipv4WithPort = candidate.match(/^(.+):(\d{1,5})$/);
    if (ipv4WithPort && isIP(ipv4WithPort[1]) === 4) candidate = ipv4WithPort[1];
  }

  if (candidate.startsWith("::ffff:") && isIP(candidate.slice(7)) === 4) {
    candidate = candidate.slice(7);
  }

  return isIP(candidate) ? candidate.toLowerCase() : null;
}

export type ClientIpOptions = {
  trustedProxyHops?: number;
};

/**
 * Returns an address only when proxy trust has been explicitly configured.
 * The selected address is the first untrusted hop when walking XFF from right
 * to left. Forwarded headers are ignored by default because clients can spoof
 * them when no trusted reverse proxy sanitizes/appends the chain.
 */
export function getClientIp(request: Request, options: ClientIpOptions = {}): string {
  const rawConfiguredHops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "", 10);
  const configuredHops =
    Number.isInteger(rawConfiguredHops) && rawConfiguredHops >= 1 && rawConfiguredHops <= 10
      ? rawConfiguredHops
      : 0;
  const trustedProxyHops = options.trustedProxyHops ?? configuredHops;
  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 1 || trustedProxyHops > 10) {
    return "unknown";
  }

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const forwardedParts = forwarded.split(",");
    if (forwardedParts.length > 20) return "unknown";
    const normalizedChain = forwardedParts.map((part) => normalizeIpCandidate(part));
    if (normalizedChain.some((part) => part === null)) return "unknown";
    const chain = normalizedChain as string[];
    const clientIndex = chain.length - trustedProxyHops;
    if (clientIndex >= 0) return chain[clientIndex];
  }

  if (trustedProxyHops === 1) {
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return normalizeIpCandidate(realIp) ?? "unknown";
  }

  return "unknown";
}

/** Test helper - clears in-memory counters between scenarios. */
export function resetRateLimitsForTests(): void {
  buckets.clear();
}

/** Test helper - verifies that the local fallback remains bounded. */
export function getRateLimitBucketCountForTests(): number {
  return buckets.size;
}
