import { beforeEach, describe, expect, it } from "vitest";

import { getClubSettings } from "@/lib/club-settings";
import { evaluateGymAccess } from "@/lib/gym-access-policy";
import { prisma } from "@/lib/prisma";
import { createSubscriptionFromPlan } from "@/lib/subscription-service";
import { isTenantModuleEnabled } from "@/lib/tenant-modules";
import { setFallbackTenantContext } from "@/lib/tenant-context";

const TENANT_ID = "tenant_test";
const TENANT_SLUG = "we-discipline";

async function createGymFixture(accessMode: "UNLIMITED" | "VISIT_QUOTA", grantedUnits: number | null) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const member = await prisma.member.create({
    data: {
      tenantId: TENANT_ID,
      firstName: "Gym",
      lastName: "Member",
      phone: `gym-${suffix}`,
    },
  });
  const plan = await prisma.subscriptionPlan.create({
    data: {
      tenantId: TENANT_ID,
      name: `Gym ${accessMode} ${suffix}`,
      planKind: "GYM",
      price: 5000,
      totalSessions: 0,
      validityDays: 30,
      entitlements: {
        create: {
          tenantId: TENANT_ID,
          type: "GYM_ACCESS",
          gymAccessMode: accessMode,
          grantedUnits,
        },
      },
    },
  });
  const subscription = await prisma.$transaction((tx) =>
    createSubscriptionFromPlan(tx, {
      tenantId: TENANT_ID,
      memberId: member.id,
      plan,
      startDate: new Date(),
    }),
  );
  const entitlement = await prisma.subscriptionEntitlement.findFirstOrThrow({
    where: { tenantId: TENANT_ID, memberSubscriptionId: subscription.id, type: "GYM_ACCESS" },
  });
  return { member, plan, subscription, entitlement };
}

describe("gym access integration", () => {
  beforeEach(async () => {
    setFallbackTenantContext({ tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, host: "test.local" });
    await prisma.tenantModule.deleteMany({ where: { tenantId: TENANT_ID, moduleKey: "GYM" } });
    await prisma.clubSettings.update({
      where: { tenantId: TENANT_ID },
      data: {
        gymAllowCheckInWithPartialPayment: true,
        gymAllowExceptionalAccess: true,
        gymDuplicateScanWindowMinutes: 2,
        gymDailyVisitLimit: null,
      },
    });
  });

  it("keeps the module disabled until the tenant explicitly enables it", async () => {
    expect(await isTenantModuleEnabled(TENANT_ID, "GYM")).toBe(false);
    await prisma.tenantModule.create({
      data: { tenantId: TENANT_ID, moduleKey: "GYM", status: "ENABLED", enabledAt: new Date() },
    });
    expect(await isTenantModuleEnabled(TENANT_ID, "GYM")).toBe(true);
  });

  it("snapshots a quota pass and applies payment, exhaustion, and override policy", async () => {
    const fixture = await createGymFixture("VISIT_QUOTA", 2);
    expect(fixture.entitlement.grantedUnits).toBe(2);
    expect(fixture.entitlement.remainingUnits).toBe(2);

    const settings = await getClubSettings({ tenantId: TENANT_ID });
    const unpaid = await prisma.$transaction((tx) =>
      evaluateGymAccess(tx, { tenantId: TENANT_ID, memberId: fixture.member.id, settings }),
    );
    expect(unpaid).toMatchObject({ allowed: false, code: "PASS_UNPAID" });

    await prisma.payment.create({
      data: { tenantId: TENANT_ID, memberSubscriptionId: fixture.subscription.id, amount: 2500 },
    });
    const partial = await prisma.$transaction((tx) =>
      evaluateGymAccess(tx, { tenantId: TENANT_ID, memberId: fixture.member.id, settings }),
    );
    expect(partial).toMatchObject({ allowed: true, code: null, unitsDelta: -1 });

    await prisma.subscriptionEntitlement.update({
      where: { id: fixture.entitlement.id },
      data: { remainingUnits: 0 },
    });
    const exhausted = await prisma.$transaction((tx) =>
      evaluateGymAccess(tx, { tenantId: TENANT_ID, memberId: fixture.member.id, settings }),
    );
    expect(exhausted).toMatchObject({ allowed: false, code: "PASS_EXHAUSTED" });

    const exceptional = await prisma.$transaction((tx) =>
      evaluateGymAccess(tx, {
        tenantId: TENANT_ID,
        memberId: fixture.member.id,
        settings,
        overrideReason: "Autorisation responsable",
      }),
    );
    expect(exceptional).toMatchObject({ allowed: true, override: true, unitsDelta: 0 });
  });

  it("records unlimited access without consuming units", async () => {
    const fixture = await createGymFixture("UNLIMITED", null);
    await prisma.payment.create({
      data: { tenantId: TENANT_ID, memberSubscriptionId: fixture.subscription.id, amount: 5000 },
    });
    const settings = await getClubSettings({ tenantId: TENANT_ID });
    const decision = await prisma.$transaction((tx) =>
      evaluateGymAccess(tx, { tenantId: TENANT_ID, memberId: fixture.member.id, settings }),
    );
    expect(decision).toMatchObject({ allowed: true, code: null, unitsDelta: 0 });
    expect(decision.entitlement?.remainingUnits).toBeNull();
  });

  it("does not resolve a member belonging to another tenant", async () => {
    const otherTenant = await prisma.tenant.upsert({
      where: { slug: "gym-other-club" },
      create: { id: "tenant_gym_other", slug: "gym-other-club", name: "Other gym" },
      update: { status: "ACTIVE" },
    });
    const foreignMember = await prisma.member.create({
      data: {
        tenantId: otherTenant.id,
        firstName: "Foreign",
        lastName: "Member",
        phone: `foreign-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    });
    const settings = await getClubSettings({ tenantId: TENANT_ID });
    const decision = await prisma.$transaction((tx) =>
      evaluateGymAccess(tx, { tenantId: TENANT_ID, memberId: foreignMember.id, settings }),
    );
    expect(decision).toMatchObject({ allowed: false, code: "MEMBER_NOT_FOUND", member: null });
  });
});
