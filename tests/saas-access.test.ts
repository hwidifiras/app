import { describe, expect, it } from "vitest";

import {
  isSaasRecoveryPath,
  resolveSaasOperationalAccess,
  type SaasSubscriptionAccessInput,
} from "@/platform/billing/saas-access";

type SubscriptionStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "GRACE" | "SUSPENDED" | "CANCELLED";
type TestSubscription = NonNullable<SaasSubscriptionAccessInput>;

function subscription(status: SubscriptionStatus, overrides: Partial<TestSubscription> = {}): TestSubscription {
  return {
    id: "saas-sub-1",
    status,
    automaticLifecycle: false,
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
    ...overrides,
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

  it.each(["TRIAL", "ACTIVE"] as const)("keeps manually managed %s access unchanged", (status) => {
    expect(resolveSaasOperationalAccess({
      tenantStatus: "ACTIVE",
      subscription: subscription(status, {
        trialEndsAt: new Date("2020-01-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2020-01-01T00:00:00.000Z"),
      }),
      now: new Date("2026-08-16T00:00:00.000Z"),
    })).toMatchObject({
      status,
      canOperate: true,
      warning: null,
    });
  });

  it.each([
    ["PAST_DUE", "PAST_DUE"],
    ["GRACE", "GRACE"],
  ] as const)("allows manually managed %s while exposing an admin warning", (status, warning) => {
    expect(resolveSaasOperationalAccess({ tenantStatus: "ACTIVE", subscription: subscription(status) })).toMatchObject({
      status,
      canOperate: true,
      warning,
    });
  });

  it("warns near the end of an automatic trial", () => {
    const access = resolveSaasOperationalAccess({
      tenantStatus: "ACTIVE",
      subscription: subscription("TRIAL", {
        automaticLifecycle: true,
        trialEndsAt: new Date("2026-08-20T00:00:00.000Z"),
        graceEndsAt: new Date("2026-08-23T00:00:00.000Z"),
      }),
      now: new Date("2026-08-16T12:00:00.000Z"),
    });

    expect(access).toMatchObject({
      status: "TRIAL",
      canOperate: true,
      warning: "TRIAL_ENDING",
      daysRemaining: 4,
      blockReason: null,
    });
  });

  it("uses the configured grace window after an automatic trial", () => {
    const access = resolveSaasOperationalAccess({
      tenantStatus: "ACTIVE",
      subscription: subscription("TRIAL", {
        automaticLifecycle: true,
        trialEndsAt: new Date("2026-08-14T00:00:00.000Z"),
        graceEndsAt: new Date("2026-08-18T00:00:00.000Z"),
      }),
      now: new Date("2026-08-16T00:00:00.000Z"),
    });

    expect(access).toMatchObject({
      status: "GRACE",
      canOperate: true,
      warning: "TRIAL_GRACE",
      daysRemaining: 2,
    });
  });

  it("blocks an expired automatic trial while preserving its plan metadata", () => {
    const access = resolveSaasOperationalAccess({
      tenantStatus: "ACTIVE",
      subscription: subscription("TRIAL", {
        automaticLifecycle: true,
        trialEndsAt: new Date("2026-08-10T00:00:00.000Z"),
        graceEndsAt: new Date("2026-08-13T00:00:00.000Z"),
      }),
      now: new Date("2026-08-16T00:00:00.000Z"),
    });

    expect(access).toMatchObject({
      status: "SUSPENDED",
      canOperate: false,
      blockReason: "TRIAL_EXPIRED",
      subscription: { planCode: "HYBRID", automaticLifecycle: true },
    });
  });

  it("moves an automatic paid period through grace before blocking", () => {
    const input = subscription("ACTIVE", {
      automaticLifecycle: true,
      currentPeriodEnd: new Date("2026-08-10T00:00:00.000Z"),
      graceEndsAt: new Date("2026-08-18T00:00:00.000Z"),
    });
    expect(resolveSaasOperationalAccess({
      tenantStatus: "ACTIVE",
      subscription: input,
      now: new Date("2026-08-16T00:00:00.000Z"),
    })).toMatchObject({ status: "GRACE", canOperate: true, warning: "GRACE" });
    expect(resolveSaasOperationalAccess({
      tenantStatus: "ACTIVE",
      subscription: input,
      now: new Date("2026-08-19T00:00:00.000Z"),
    })).toMatchObject({ status: "SUSPENDED", canOperate: false, blockReason: "BILLING_GRACE_EXPIRED" });
  });

  it.each(["SUSPENDED", "CANCELLED"] as const)("blocks operations for %s without deleting product grants", (status) => {
    const access = resolveSaasOperationalAccess({ tenantStatus: "ACTIVE", subscription: subscription(status) });
    expect(access.canOperate).toBe(false);
    expect(access.subscription?.planCode).toBe("HYBRID");
  });

  it("keeps platform suspension authoritative", () => {
    expect(
      resolveSaasOperationalAccess({ tenantStatus: "SUSPENDED", subscription: subscription("ACTIVE") }),
    ).toMatchObject({ canOperate: false, blockReason: "TENANT_SUSPENDED" });
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
