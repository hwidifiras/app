import { describe, expect, it } from "vitest";

import { buildProductionContentSecurityPolicy, productionSecurityHeaders } from "../next.config";

describe("production security headers", () => {
  it("allows the first-party gym QR scanner without opening other sensors", () => {
    const permissionsPolicy = productionSecurityHeaders.find(
      (header) => header.key === "Permissions-Policy",
    );

    expect(permissionsPolicy?.value).toBe("camera=(self), microphone=(), geolocation=()");
  });

  it("allows anti-bot providers and a one-time handoff to tenant subdomains", () => {
    const csp = buildProductionContentSecurityPolicy("we-discipline.com");
    expect(csp).toContain("form-action 'self' https://*.we-discipline.com");
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain("https://www.google.com");
  });
});
