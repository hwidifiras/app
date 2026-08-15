import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { createSubscriptionFromPlan } from "@/lib/subscription-service";
import { withTenantContext } from "@/lib/tenant-context";
import { getGymReportSnapshot } from "@/modules/gym/gym-report";

describe("gym reporting", () => {
  it("counts only the requested tenant and excludes reversed visits", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tenant = await prisma.tenant.create({
      data: { slug: `gym-report-${suffix}`, name: "Gym Report Test" },
    });
    await withTenantContext({ tenantId: tenant.id, tenantSlug: tenant.slug, host: `${tenant.slug}.test` }, async () => {
      const actor = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `report-${suffix}@example.test`,
        name: "Responsable salle",
        passwordHash: "test",
        role: "ADMIN",
      },
    });
    const member = await prisma.member.create({
      data: { tenantId: tenant.id, firstName: "Rapport", lastName: "Salle", phone: `report-${suffix}` },
    });
    const plan = await prisma.subscriptionPlan.create({
      data: {
        tenantId: tenant.id,
        name: `Pass rapport ${suffix}`,
        planKind: "GYM",
        price: 7000,
        totalSessions: 0,
        validityDays: 30,
        entitlements: {
          create: { tenantId: tenant.id, type: "GYM_ACCESS", gymAccessMode: "VISIT_QUOTA", grantedUnits: 10 },
        },
      },
      include: { entitlements: true },
    });
    const now = new Date("2026-08-15T10:00:00.000Z");
    const subscription = await prisma.$transaction((tx) => createSubscriptionFromPlan(tx, {
      tenantId: tenant.id,
      memberId: member.id,
      plan,
      startDate: new Date("2026-08-01T00:00:00.000Z"),
    }));
    await prisma.payment.create({
      data: { tenantId: tenant.id, memberSubscriptionId: subscription.id, amount: 3500, paymentDate: now },
    });
    const entitlement = await prisma.subscriptionEntitlement.findFirstOrThrow({
      where: { tenantId: tenant.id, memberSubscriptionId: subscription.id, type: "GYM_ACCESS" },
    });
    const keptVisit = await prisma.gymVisit.create({
      data: {
        tenantId: tenant.id,
        memberId: member.id,
        memberSubscriptionId: subscription.id,
        subscriptionEntitlementId: entitlement.id,
        entryType: "CHECK_IN",
        unitsDelta: -1,
        checkedById: actor.id,
        checkedAt: now,
      },
    });
    const reversedVisit = await prisma.gymVisit.create({
      data: {
        tenantId: tenant.id,
        memberId: member.id,
        memberSubscriptionId: subscription.id,
        subscriptionEntitlementId: entitlement.id,
        entryType: "CHECK_IN",
        unitsDelta: -1,
        checkedById: actor.id,
        checkedAt: new Date("2026-08-15T10:05:00.000Z"),
      },
    });
    await prisma.gymVisit.create({
      data: {
        tenantId: tenant.id,
        memberId: member.id,
        memberSubscriptionId: subscription.id,
        subscriptionEntitlementId: entitlement.id,
        entryType: "REVERSAL",
        unitsDelta: 1,
        checkedById: actor.id,
        checkedAt: new Date("2026-08-15T10:06:00.000Z"),
        correctsVisitId: reversedVisit.id,
        correctionReason: "Double scan",
      },
    });
    await prisma.gymAccessAttempt.createMany({
      data: [
        {
          tenantId: tenant.id,
          memberId: member.id,
          outcome: "DENIED",
          failureCode: "PASS_UNPAID",
          checkedById: actor.id,
          occurredAt: now,
        },
        {
          tenantId: tenant.id,
          memberId: member.id,
          outcome: "EXCEPTIONAL_ALLOWED",
          overrideReason: "Accord responsable",
          checkedById: actor.id,
          occurredAt: now,
        },
      ],
    });

    const snapshot = await getGymReportSnapshot(prisma, {
      tenantId: tenant.id,
      range: { from: new Date("2026-08-01T00:00:00.000Z"), to: new Date("2026-09-01T00:00:00.000Z") },
      now,
    });

    expect(keptVisit.id).toBeTruthy();
    expect(snapshot).toMatchObject({
      visits: 1,
      overrides: 1,
      denials: 1,
      activePasses: 1,
      unpaidPasses: 1,
      sales: 1,
      salesAmount: 7000,
    });
      expect(snapshot.denialsByCode).toEqual({ PASS_UNPAID: 1 });
    });
  });
});
