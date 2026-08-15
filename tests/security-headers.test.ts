import { describe, expect, it } from "vitest";

import { productionSecurityHeaders } from "../next.config";

describe("production security headers", () => {
  it("allows the first-party gym QR scanner without opening other sensors", () => {
    const permissionsPolicy = productionSecurityHeaders.find(
      (header) => header.key === "Permissions-Policy",
    );

    expect(permissionsPolicy?.value).toBe("camera=(self), microphone=(), geolocation=()");
  });
});
