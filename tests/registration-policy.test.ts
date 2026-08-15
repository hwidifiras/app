import { describe, expect, it } from "vitest";

import {
  isPublicRegistrationGloballyEnabled,
  resolvePublicRegistrationPolicy,
} from "@/lib/registration-policy";

describe("public registration policy", () => {
  it("requires the global kill switch and the tenant setting", () => {
    expect(resolvePublicRegistrationPolicy(true, "false")).toEqual({
      globallyEnabled: false,
      tenantEnabled: true,
      enabled: false,
    });
    expect(resolvePublicRegistrationPolicy(false, "true")).toEqual({
      globallyEnabled: true,
      tenantEnabled: false,
      enabled: false,
    });
    expect(resolvePublicRegistrationPolicy(true, "true")).toEqual({
      globallyEnabled: true,
      tenantEnabled: true,
      enabled: true,
    });
  });

  it("treats only an explicit true value as globally enabled", () => {
    expect(isPublicRegistrationGloballyEnabled(undefined)).toBe(false);
    expect(isPublicRegistrationGloballyEnabled("1")).toBe(false);
    expect(isPublicRegistrationGloballyEnabled(" TRUE ")).toBe(true);
  });
});
