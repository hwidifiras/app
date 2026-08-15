import { describe, expect, it } from "vitest";

import { applySessionBalanceDelta } from "@/lib/attendance-session-adjustment";
import { getClubSettings } from "@/lib/club-settings";
import { prisma } from "@/lib/prisma";
import { parseReceiptSnapshot } from "@/lib/receipts";
import { withTenantContext } from "@/lib/tenant-context";
import { recordGymCheckIn } from "@/modules/gym/check-in-service";
import { sellSubscription } from "@/modules/sales/subscription-sale-service";
import { TEST_TENANT_ID, TEST_TENANT_SLUG } from "./setup";

describe("hybrid edition acceptance", () => {
  it("sells one mixed package and consumes class and gym rights independently", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now = new Date("2026-08-15T10:00:00.000Z");

    await prisma.tenantModule.upsert({
      where: { tenantId_moduleKey: { tenantId: TEST_TENANT_ID, moduleKey: "GYM_ACCESS" } },
      create: {
        tenantId: TEST_TENANT_ID,
        moduleKey: "GYM_ACCESS",
        status: "ENABLED",
        enabledAt: now,
      },
      update: { status: "ENABLED", enabledAt: now, disabledAt: null },
    });

    await withTenantContext(
      { tenantId: TEST_TENANT_ID, tenantSlug: TEST_TENANT_SLUG, host: "test.local" },
      async () => {
        const actor = await prisma.user.create({
          data: {
            tenantId: TEST_TENANT_ID,
            email: `hybrid-${suffix}@example.test`,
            name: "Responsable hybride",
            passwordHash: "test",
            role: "ADMIN",
          },
        });
        const member = await prisma.member.create({
          data: {
            tenantId: TEST_TENANT_ID,
            firstName: "Pack",
            lastName: "Hybride",
            phone: `hybrid-${suffix}`,
          },
        });
        const sport = await prisma.sport.create({
          data: { tenantId: TEST_TENANT_ID, name: `Kick-boxing ${suffix}` },
        });
        const plan = await prisma.subscriptionPlan.create({
          data: {
            tenantId: TEST_TENANT_ID,
            name: `Cours + salle ${suffix}`,
            planKind: "MIXED",
            price: 12_000,
            totalSessions: 0,
            validityDays: 30,
            entitlements: {
              create: [
                {
                  tenantId: TEST_TENANT_ID,
                  type: "CLASS_SESSIONS",
                  sportId: sport.id,
                  sessionsPerWeek: 2,
                  grantedUnits: 8,
                  sortOrder: 0,
                },
                {
                  tenantId: TEST_TENANT_ID,
                  type: "GYM_ACCESS",
                  gymAccessMode: "VISIT_QUOTA",
                  grantedUnits: 12,
                  sortOrder: 1,
                },
              ],
            },
          },
        });

        const sale = await prisma.$transaction((tx) => sellSubscription(tx, {
          tenantId: TEST_TENANT_ID,
          actorId: actor.id,
          memberId: member.id,
          plan,
          startDate: new Date("2026-08-01T00:00:00.000Z"),
          source: "hybrid-acceptance-test",
          paymentCents: 12_000,
          paymentMethod: "CASH",
        }));

        const initialRights = await prisma.subscriptionEntitlement.findMany({
          where: { tenantId: TEST_TENANT_ID, memberSubscriptionId: sale.subscription.id },
          orderBy: { createdAt: "asc" },
        });
        const classRight = initialRights.find((right) => right.type === "CLASS_SESSIONS");
        const gymRight = initialRights.find((right) => right.type === "GYM_ACCESS");
        expect(classRight?.remainingUnits).toBe(8);
        expect(gymRight?.remainingUnits).toBe(12);

        await prisma.$transaction(async (tx) => {
          const balance = await applySessionBalanceDelta(tx, {
            delta: -1,
            memberSubscriptionId: sale.subscription.id,
            subscriptionEntitlementId: classRight?.id,
            memberId: member.id,
            sportId: sport.id,
          });
          expect(balance.subscriptionEntitlementId).toBe(classRight?.id);
        });

        const afterClass = await prisma.subscriptionEntitlement.findMany({
          where: { tenantId: TEST_TENANT_ID, memberSubscriptionId: sale.subscription.id },
        });
        expect(afterClass.find((right) => right.type === "CLASS_SESSIONS")?.remainingUnits).toBe(7);
        expect(afterClass.find((right) => right.type === "GYM_ACCESS")?.remainingUnits).toBe(12);
        expect((await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sale.subscription.id } })).remainingSessions).toBe(0);

        const settings = await getClubSettings({ tenantId: TEST_TENANT_ID });
        const admission = await recordGymCheckIn(prisma, {
          tenantId: TEST_TENANT_ID,
          actorId: actor.id,
          memberId: member.id,
          settings: { ...settings, gymDuplicateScanWindowMinutes: 0 },
          now,
        });
        expect(admission.visit).not.toBeNull();

        const finalRights = await prisma.subscriptionEntitlement.findMany({
          where: { tenantId: TEST_TENANT_ID, memberSubscriptionId: sale.subscription.id },
        });
        expect(finalRights.find((right) => right.type === "CLASS_SESSIONS")?.remainingUnits).toBe(7);
        expect(finalRights.find((right) => right.type === "GYM_ACCESS")?.remainingUnits).toBe(11);

        const [subscriptionCount, paymentCount, receiptCount, visitCount] = await Promise.all([
          prisma.memberSubscription.count({ where: { tenantId: TEST_TENANT_ID, id: sale.subscription.id } }),
          prisma.payment.count({ where: { tenantId: TEST_TENANT_ID, memberSubscriptionId: sale.subscription.id } }),
          prisma.receipt.count({ where: { tenantId: TEST_TENANT_ID, payment: { memberSubscriptionId: sale.subscription.id } } }),
          prisma.gymVisit.count({ where: { tenantId: TEST_TENANT_ID, memberSubscriptionId: sale.subscription.id } }),
        ]);
        expect({ subscriptionCount, paymentCount, receiptCount, visitCount }).toEqual({
          subscriptionCount: 1,
          paymentCount: 1,
          receiptCount: 1,
          visitCount: 1,
        });

        const receipt = await prisma.receipt.findFirstOrThrow({
          where: { tenantId: TEST_TENANT_ID, payment: { memberSubscriptionId: sale.subscription.id } },
        });
        const snapshot = parseReceiptSnapshot(receipt);
        expect(snapshot?.subscription.planName).toBe(plan.name);
        expect(snapshot?.subscription.entitlements?.map((right) => right.label)).toEqual([
          sport.name,
          "Accès salle",
        ]);
        expect(snapshot?.totals).toEqual({ paidAfterCents: 12_000, remainingAfterCents: 0 });
      },
    );
  });
});
