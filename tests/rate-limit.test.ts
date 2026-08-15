import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkRateLimit,
  getClientIp,
  getRateLimitBucketCountForTests,
  resetRateLimitsForTests,
} from "@/lib/rate-limit";

function requestWithForwardedHeaders(headers: Record<string, string>) {
  return new Request("https://club.example.test/api/auth/login", { headers });
}

describe("rate-limit storage", () => {
  beforeEach(() => {
    resetRateLimitsForTests();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_URL", "");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_TOKEN", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  });

  afterEach(() => {
    resetRateLimitsForTests();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("enforces limits with the bounded local fallback", async () => {
    await expect(checkRateLimit("login:tenant:client", 2, 60_000)).resolves.toEqual({ allowed: true });
    await expect(checkRateLimit("login:tenant:client", 2, 60_000)).resolves.toEqual({ allowed: true });

    const blocked = await checkRateLimit("login:tenant:client", 2, 60_000);
    expect(blocked).toMatchObject({ allowed: false, reason: "limit" });
  });

  it("caps local buckets to prevent unbounded memory growth", async () => {
    vi.stubEnv("RATE_LIMIT_MEMORY_MAX_BUCKETS", "2");

    await checkRateLimit("one", 2, 60_000);
    await checkRateLimit("two", 2, 60_000);
    await checkRateLimit("three", 2, 60_000);

    expect(getRateLimitBucketCountForTests()).toBe(2);
  });

  it("fails closed in production when the shared backend is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(checkRateLimit("login:tenant:client", 2, 60_000)).resolves.toEqual({
      allowed: false,
      reason: "unavailable",
      retryAfterSeconds: 60,
    });
    expect(getRateLimitBucketCountForTests()).toBe(0);
  });

  it("uses an atomic REST Redis command when a shared backend is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_URL", "https://redis.example.test");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_TOKEN", "secret-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: [4, 42_000] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkRateLimit("login:tenant:client", 3, 60_000);

    expect(result).toEqual({ allowed: false, reason: "limit", retryAfterSeconds: 42 });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://redis.example.test");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
    const command = JSON.parse(String(init.body)) as unknown[];
    expect(command[0]).toBe("EVAL");
    expect(command[2]).toBe("1");
    expect(command[4]).toBe("60000");
  });

  it("does not bypass a configured shared backend when it is unavailable", async () => {
    vi.stubEnv("RATE_LIMIT_REDIS_REST_URL", "https://redis.example.test");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_TOKEN", "secret-token");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(checkRateLimit("login:tenant:client", 3, 60_000)).resolves.toEqual({
      allowed: false,
      reason: "unavailable",
      retryAfterSeconds: 60,
    });
    expect(getRateLimitBucketCountForTests()).toBe(0);
  });
});

describe("trusted proxy client addresses", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ignores spoofable forwarded headers unless proxy trust is configured", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "0");
    const request = requestWithForwardedHeaders({
      "x-forwarded-for": "203.0.113.7",
      "x-real-ip": "203.0.113.8",
    });

    expect(getClientIp(request)).toBe("unknown");
  });

  it("selects the first untrusted address from a sanitized proxy chain", () => {
    const request = requestWithForwardedHeaders({
      "x-forwarded-for": "203.0.113.7, 198.51.100.20",
    });

    expect(getClientIp(request, { trustedProxyHops: 1 })).toBe("198.51.100.20");
    expect(getClientIp(request, { trustedProxyHops: 2 })).toBe("203.0.113.7");
  });

  it("rejects malformed chains instead of shifting the trust boundary", () => {
    const request = requestWithForwardedHeaders({
      "x-forwarded-for": "spoofed-value, 198.51.100.20",
    });

    expect(getClientIp(request, { trustedProxyHops: 1 })).toBe("unknown");
  });
});
