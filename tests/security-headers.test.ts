import { describe, expect, it } from "vitest";

import { buildProductionContentSecurityPolicy, productionSecurityHeaders } from "../next.config";

describe("production security headers", () => {
  it("allows the first-party gym QR scanner without opening other sensors", () => {
    const permissionsPolicy = productionSecurityHeaders.find(
      (header) => header.key === "Permissions-Policy",
    );

    expect(permissionsPolicy?.value).toBe("camera=(self), microphone=(), geolocation=()");
  });

  it("keeps desktop requests local without third-party script providers", () => {
    const csp = buildProductionContentSecurityPolicy("we-discipline.com");
    expect(csp).toContain("form-action 'self' https://*.we-discipline.com");
    expect(csp).not.toContain("https://challenges.cloudflare.com");
    expect(csp).not.toContain("https://www.google.com");
  });
});
