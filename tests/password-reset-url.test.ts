import { afterEach, describe, expect, it, vi } from "vitest";

import { buildResetUrl } from "@/lib/password-reset";

describe("tenant password-reset links", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("keeps the validated tenant origin ahead of the platform fallback", () => {
    vi.stubEnv("APP_URL", "https://default.example.com");

    const url = new URL(buildResetUrl("tenant-token", "https://tenant-a.example.com"));

    expect(url.origin).toBe("https://tenant-a.example.com");
    expect(url.pathname).toBe("/reset-password");
    expect(url.searchParams.get("token")).toBe("tenant-token");
  });

  it("uses APP_URL only when no tenant origin is available", () => {
    vi.stubEnv("APP_URL", "https://default.example.com");
    expect(new URL(buildResetUrl("fallback-token")).origin).toBe("https://default.example.com");
  });
});
