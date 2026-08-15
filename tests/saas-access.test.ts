import { describe, expect, it } from "vitest";

import {
  isSaasRecoveryPath,
  resolveSaasOperationalAccess,
} from "@/platform/billing/saas-access";

function subscription(status: "TRIAL" | "ACTIVE" | "PAST_DUE" | "GRACE" | "SUSPENDED" | "CANCELLED") {
  return {
    id: "saas-sub-1",
    status,
    startsAt: new Date("2026-08-01T00:00:00.000Z"),
    trialEndsAt: null,
    currentPeriodEnd: new Date("2026-08-31T23:59:59.000Z"),
    graceEndsAt: new Date("2026-09-07T23:59:59.000Z"),
    plan: {
      code: "HYBRID",
      name: "Gestion hybride",
      userLimit: 10,
      memberLimit: 500,
    },
  };
}

describe("SaaS operational access", () => {
  it("keeps existing tenants without a commercial subscription operational", () => {
    expect(resolveSaasOperationalAccess({ tenantStatus: "ACTIVE", subscription: null })).toMatchObject({
      status: "LEGACY_ACTIVE",
      canOperate: true,
      warning: null,
    });
  });

  it.each(["TRIAL", "ACTIVE"] as const)("allows %s without a warning", (status) => {
    expect(resolveSaasOperationalAccess({ tenantStatus: "ACTIVE", subscription: subscription(status) })).toMatchObject({
      status,
      canOperate: true,
      warning: null,
    });
  });

  it.each([
    ["PAST_DUE", "PAST_DUE"],
    ["GRACE", "GRACE"],
  ] as const)("allows %s while exposing an admin warning", (status, warning) => {
    expect(resolveSaasOperationalAccess({ tenantStatus: "ACTIVE", subscription: subscription(status) })).toMatchObject({
      status,
      canOperate: true,
      warning,
    });
  });

  it.each(["SUSPENDED", "CANCELLED"] as const)("blocks operations for %s without deleting product grants", (status) => {
    const access = resolveSaasOperationalAccess({ tenantStatus: "ACTIVE", subscription: subscription(status) });
    expect(access.canOperate).toBe(false);
    expect(access.subscription?.planCode).toBe("HYBRID");
  });

  it("keeps platform suspension authoritative", () => {
    expect(
      resolveSaasOperationalAccess({ tenantStatus: "SUSPENDED", subscription: subscription("ACTIVE") }).canOperate,
    ).toBe(false);
  });
});

describe("SaaS recovery routes", () => {
  it("only exempts the status and account recovery surfaces", () => {
    expect(isSaasRecoveryPath("/subscription-status")).toBe(true);
    expect(isSaasRecoveryPath("/settings/account")).toBe(true);
    expect(isSaasRecoveryPath("/api/account")).toBe(true);
    expect(isSaasRecoveryPath("/payments/new")).toBe(false);
    expect(isSaasRecoveryPath("/api/gym/check-in")).toBe(false);
  });
});
