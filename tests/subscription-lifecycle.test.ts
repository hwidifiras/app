import { describe, expect, it } from "vitest";

import { getClubSettings } from "@/lib/club-settings";
import { evaluateGymAccess } from "@/lib/gym-access-policy";
import { getSubscriptionLedgerTotal } from "@/lib/payment-ledger";
import { prisma } from "@/lib/prisma";
import { createSubscriptionFromPlan } from "@/lib/subscription-service";
import { withTenantContext } from "@/lib/tenant-context";
import {
  adjustEntitlementUnits,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
} from "@/modules/sales/subscription-lifecycle-service";
import { resolveSubscriptionEffectiveState } from "@/modules/sales/subscription-lifecycle";
import { replaceSubscription } from "@/modules/sales/subscription-replacement-service";
import { sellSubscription } from "@/modules/sales/subscription-sale-service";

const DAY_MS = 86_400_000;

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS);
}

async function withLifecycleTenant<T>(
  run: (fixture: { tenantId: string; actorId: string }) => Promise<T>,
) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tenantId = `tenant-lifecycle-${suffix}`;
  const tenantSlug = `lifecycle-${suffix}`;
  await prisma.tenant.create({
    data: { id: tenantId, slug: tenantSlug, name: "Lifecycle Test Club" },
  });

  return withTenantContext(
    { tenantId, tenantSlug, host: `${tenantSlug}.test.local` },
    async () => {
      await prisma.clubSettings.create({
        data: {
          tenantId,
          clubName: "Lifecycle Test Club",
          gymAllowCheckInWithPartialPayment: true,
          gymAllowExceptionalAccess: true,
        },
      });
      const actor = await prisma.user.create({
        data: {
          tenantId,
          email: `admin-${suffix}@test.local`,
          name: "Lifecycle Admin",
          role: "ADMIN",
          passwordHash: "test-hash",
        },
      });
      return run({ tenantId, actorId: actor.id });
    },
  );
}

async function createMember(tenantId: string, suffix: string) {
  return prisma.member.create({
    data: {
      tenantId,
      firstName: "Test",
      lastName: "Lifecycle",
      phone: `lifecycle-member-${suffix}`,
    },
  });
}

describe("subscription effective lifecycle", () => {
  it("keeps the current right active until a fixed-date renewal takes effect", async () => {
    await withLifecycleTenant(async ({ tenantId }) => {
      const now = new Date("2026-08-15T10:00:00.000Z");
      const member = await createMember(tenantId, "queued");
      const sport = await prisma.sport.create({ data: { tenantId, name: "Queued Karate" } });
      const plan = await prisma.subscriptionPlan.create({
        data: {
          tenantId,
          name: "Queued class plan",
          planKind: "CLASS",
          sportId: sport.id,
          price: 5_000,
          totalSessions: 8,
          sessionsPerWeek: 2,
          validityDays: 30,
          entitlements: {
            create: {
              tenantId,
              type: "CLASS_SESSIONS",
              sportId: sport.id,
              sessionsPerWeek: 2,
              grantedUnits: 8,
            },
          },
        },
      });

      const current = await prisma.$transaction((tx) =>
        createSubscriptionFromPlan(
          tx,
          { tenantId, memberId: member.id, plan, startDate: addDays(now, -10) },
          { now },
        ),
      );
      const renewalStart = addDays(current.endDate as Date, 1);
      const renewal = await prisma.$transaction((tx) =>
        createSubscriptionFromPlan(
          tx,
          { tenantId, memberId: member.id, plan, startDate: renewalStart },
          { now },
        ),
      );

      const storedCurrent = await prisma.memberSubscription.findFirstOrThrow({
        where: { tenantId, id: current.id },
        include: {
          pauseEvents: true,
          renewedBySubscription: {
            select: { status: true, activationPolicy: true, activatedAt: true, startDate: true },
          },
        },
      });
      const storedRenewal = await prisma.memberSubscription.findFirstOrThrow({
        where: { tenantId, id: renewal.id },
        include: { pauseEvents: true },
      });

      expect(storedCurrent.status).toBe("ACTIVE");
      expect(renewal.renewsSubscriptionId).toBe(current.id);
      expect(resolveSubscriptionEffectiveState(storedCurrent, now)).toBe("ACTIVE");
      expect(resolveSubscriptionEffectiveState(storedRenewal, now)).toBe("SCHEDULED");
      expect(resolveSubscriptionEffectiveState(storedCurrent, addDays(renewalStart, 1))).toBe("EXPIRED");
      expect(resolveSubscriptionEffectiveState(storedRenewal, addDays(renewalStart, 1))).toBe("ACTIVE");
    });
  });

  it("activates a first-use gym pass once and snapshots its real dates", async () => {
    await withLifecycleTenant(async ({ tenantId, actorId }) => {
      const availableAt = new Date("2026-08-15T08:00:00.000Z");
      const admittedAt = addDays(availableAt, 12);
      const member = await createMember(tenantId, "first-use");
      const plan = await prisma.subscriptionPlan.create({
        data: {
          tenantId,
          name: "First use gym",
          planKind: "GYM",
          activationPolicy: "FIRST_USE",
          activationWindowDays: 90,
          price: 0,
          totalSessions: 0,
          validityDays: 30,
          freezeAllowanceCount: 1,
          freezeMaxTotalDays: 30,
          entitlements: {
            create: {
              tenantId,
              type: "GYM_ACCESS",
              gymAccessMode: "UNLIMITED",
            },
          },
        },
      });
      const subscription = await prisma.$transaction((tx) =>
        createSubscriptionFromPlan(
          tx,
          { tenantId, memberId: member.id, plan, startDate: availableAt },
          { now: availableAt },
        ),
      );
      expect(subscription.endDate).toBeNull();
      expect(subscription.activatedAt).toBeNull();

      const settings = await getClubSettings({ tenantId });
      const decision = await prisma.$transaction((tx) =>
        evaluateGymAccess(tx, {
          tenantId,
          memberId: member.id,
          actorId,
          settings,
          now: admittedAt,
          activatePending: true,
        }),
      );
      expect(decision).toMatchObject({ allowed: true, code: null });

      const activated = await prisma.memberSubscription.findFirstOrThrow({
        where: { tenantId, id: subscription.id },
        include: { entitlements: true },
      });
      expect(activated.activatedAt?.toISOString()).toBe(admittedAt.toISOString());
      expect(activated.startDate.toISOString()).toBe(admittedAt.toISOString());
      expect(activated.endDate?.toISOString()).toBe(addDays(admittedAt, 30).toISOString());
      expect(activated.entitlements[0].startDate.toISOString()).toBe(admittedAt.toISOString());
      expect(activated.entitlements[0].endDate?.toISOString()).toBe(addDays(admittedAt, 30).toISOString());
      expect(await prisma.entitlementAdjustment.count({
        where: { tenantId, memberSubscriptionId: subscription.id, kind: "ACTIVATION" },
      })).toBe(1);
    });
  });

  it("records pause and resume append-only while capping a late extension", async () => {
    await withLifecycleTenant(async ({ tenantId, actorId }) => {
      const now = new Date("2026-08-15T10:00:00.000Z");
      const member = await createMember(tenantId, "pause");
      const sport = await prisma.sport.create({ data: { tenantId, name: "Pause Boxing" } });
      const coach = await prisma.coach.create({
        data: { tenantId, firstName: "Pause", lastName: "Coach", phone: "pause-coach", sportId: sport.id },
      });
      const group = await prisma.group.create({
        data: { tenantId, name: "Pause Group", sportId: sport.id, coachId: coach.id, capacity: 20 },
      });
      const plan = await prisma.subscriptionPlan.create({
        data: {
          tenantId,
          name: "Pausable classes",
          planKind: "CLASS",
          sportId: sport.id,
          price: 4_000,
          totalSessions: 10,
          validityDays: 30,
          freezeAllowanceCount: 1,
          freezeMaxTotalDays: 3,
          entitlements: {
            create: { tenantId, type: "CLASS_SESSIONS", sportId: sport.id, grantedUnits: 10 },
          },
        },
      });
      const subscription = await prisma.$transaction((tx) =>
        createSubscriptionFromPlan(
          tx,
          { tenantId, memberId: member.id, plan, startDate: addDays(now, -5) },
          { now },
        ),
      );
      await prisma.groupMember.create({
        data: {
          tenantId,
          groupId: group.id,
          memberId: member.id,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          status: "ACTIVE",
        },
      });

      await prisma.$transaction((tx) =>
        pauseSubscription(tx, {
          tenantId,
          subscriptionId: subscription.id,
          actorId,
          reason: "Arret medical documente",
          at: now,
        }),
      );
      const frozen = await prisma.memberSubscription.findFirstOrThrow({
        where: { tenantId, id: subscription.id },
        include: { pauseEvents: true },
      });
      expect(resolveSubscriptionEffectiveState(frozen, addDays(now, 1))).toBe("FROZEN");

      const resumed = await prisma.$transaction((tx) =>
        resumeSubscription(tx, {
          tenantId,
          subscriptionId: subscription.id,
          actorId,
          reason: "Retour valide par le club",
          at: addDays(now, 5),
        }),
      );
      expect(resumed.nextEndDate?.toISOString()).toBe(addDays(subscription.endDate as Date, 3).toISOString());

      const events = await prisma.subscriptionPause.findMany({
        where: { tenantId, memberSubscriptionId: subscription.id },
        orderBy: { effectiveAt: "asc" },
      });
      expect(events.map((event) => event.entryType)).toEqual(["PAUSE", "RESUME"]);
      expect(events[1].pauseEventId).toBe(events[0].id);
      expect(events[1].durationSeconds).toBe(3 * 86_400);
      const assignment = await prisma.groupMember.findFirstOrThrow({
        where: { tenantId, memberId: member.id, groupId: group.id },
      });
      expect(assignment.endDate?.toISOString()).toBe(addDays(subscription.endDate as Date, 3).toISOString());
    });
  });

  it("dual-writes a traced class entitlement correction", async () => {
    await withLifecycleTenant(async ({ tenantId, actorId }) => {
      const now = new Date("2026-08-15T10:00:00.000Z");
      const member = await createMember(tenantId, "adjust");
      const sport = await prisma.sport.create({ data: { tenantId, name: "Adjustment Judo" } });
      const plan = await prisma.subscriptionPlan.create({
        data: {
          tenantId,
          name: "Adjustment plan",
          planKind: "CLASS",
          sportId: sport.id,
          price: 3_000,
          totalSessions: 8,
          validityDays: 30,
          entitlements: {
            create: { tenantId, type: "CLASS_SESSIONS", sportId: sport.id, grantedUnits: 8 },
          },
        },
      });
      const subscription = await prisma.$transaction((tx) =>
        createSubscriptionFromPlan(tx, { tenantId, memberId: member.id, plan, startDate: now }, { now }),
      );
      const entitlement = await prisma.subscriptionEntitlement.findFirstOrThrow({
        where: { tenantId, memberSubscriptionId: subscription.id },
      });

      await prisma.$transaction((tx) =>
        adjustEntitlementUnits(tx, {
          tenantId,
          subscriptionId: subscription.id,
          entitlementId: entitlement.id,
          unitsDelta: -2,
          actorId,
          reason: "Correction de deux passages oublies",
        }),
      );
      const updated = await prisma.memberSubscription.findFirstOrThrow({
        where: { tenantId, id: subscription.id },
        include: { entitlements: true },
      });
      expect(updated.remainingSessions).toBe(6);
      expect(updated.entitlements[0].remainingUnits).toBe(6);
      await expect(prisma.entitlementAdjustment.findFirstOrThrow({
        where: { tenantId, memberSubscriptionId: subscription.id, kind: "UNITS" },
      })).resolves.toMatchObject({
        unitsDelta: -2,
        previousRemainingUnits: 8,
        nextRemainingUnits: 6,
        createdById: actorId,
      });
    });
  });

  it("replaces a wrong sale without rewriting its payment or receipt", async () => {
    await withLifecycleTenant(async ({ tenantId, actorId }) => {
      const now = new Date("2026-08-15T10:00:00.000Z");
      const member = await createMember(tenantId, "replacement");
      const oldPlan = await prisma.subscriptionPlan.create({
        data: {
          tenantId,
          name: "Wrong gym plan",
          planKind: "GYM",
          price: 5_000,
          totalSessions: 0,
          validityDays: 30,
          entitlements: {
            create: { tenantId, type: "GYM_ACCESS", gymAccessMode: "UNLIMITED" },
          },
        },
        include: { entitlements: true },
      });
      const newPlan = await prisma.subscriptionPlan.create({
        data: {
          tenantId,
          name: "Correct gym plan",
          planKind: "GYM",
          price: 6_000,
          totalSessions: 0,
          validityDays: 45,
          entitlements: {
            create: { tenantId, type: "GYM_ACCESS", gymAccessMode: "UNLIMITED" },
          },
        },
        include: { entitlements: true },
      });
      const originalSale = await prisma.$transaction((tx) =>
        sellSubscription(tx, {
          tenantId,
          actorId,
          memberId: member.id,
          plan: oldPlan,
          startDate: now,
          source: "lifecycle-test",
          paymentCents: 5_000,
          paymentMethod: "CASH",
        }),
      );
      const originalPaymentId = originalSale.payment?.id as string;
      const originalReceiptId = originalSale.receipt?.id as string;

      const replacement = await prisma.$transaction((tx) =>
        replaceSubscription(tx, {
          tenantId,
          actorId,
          subscriptionId: originalSale.subscription.id,
          plan: newPlan,
          startDate: now,
          reason: "Mauvaise formule choisie a la reception",
        }),
      );

      const original = await prisma.memberSubscription.findFirstOrThrow({
        where: { tenantId, id: originalSale.subscription.id },
      });
      const corrected = await prisma.memberSubscription.findFirstOrThrow({
        where: { tenantId, id: replacement.replacementSubscriptionId },
      });
      expect(original.status).toBe("CANCELLED");
      expect(corrected.replacesSubscriptionId).toBe(original.id);
      expect(await getSubscriptionLedgerTotal(prisma, original.id, tenantId)).toBe(0);
      expect(await getSubscriptionLedgerTotal(prisma, corrected.id, tenantId)).toBe(5_000);
      expect(await prisma.payment.findFirst({ where: { tenantId, id: originalPaymentId } })).not.toBeNull();
      await expect(prisma.receipt.findFirstOrThrow({
        where: { tenantId, id: originalReceiptId },
      })).resolves.toMatchObject({ status: "VOIDED" });
      await expect(prisma.receipt.findFirstOrThrow({
        where: { tenantId, id: replacement.receipt?.id },
      })).resolves.toMatchObject({ status: "ISSUED" });
    });
  });

  it("closes class assignments on cancellation only when no other current right remains", async () => {
    await withLifecycleTenant(async ({ tenantId, actorId }) => {
      const now = new Date("2026-08-15T10:00:00.000Z");
      const member = await createMember(tenantId, "cancel");
      const sport = await prisma.sport.create({ data: { tenantId, name: "Cancel Aikido" } });
      const coach = await prisma.coach.create({
        data: { tenantId, firstName: "Cancel", lastName: "Coach", phone: "cancel-coach", sportId: sport.id },
      });
      const group = await prisma.group.create({
        data: { tenantId, name: "Cancel Group", sportId: sport.id, coachId: coach.id, capacity: 20 },
      });
      const plan = await prisma.subscriptionPlan.create({
        data: {
          tenantId,
          name: "Cancel plan",
          planKind: "CLASS",
          sportId: sport.id,
          price: 2_000,
          totalSessions: 4,
          validityDays: 30,
          entitlements: {
            create: { tenantId, type: "CLASS_SESSIONS", sportId: sport.id, grantedUnits: 4 },
          },
        },
      });
      const subscription = await prisma.$transaction((tx) =>
        createSubscriptionFromPlan(tx, { tenantId, memberId: member.id, plan, startDate: now }, { now }),
      );
      await prisma.groupMember.create({
        data: { tenantId, groupId: group.id, memberId: member.id, startDate: now, status: "ACTIVE" },
      });

      const result = await prisma.$transaction((tx) =>
        cancelSubscription(tx, {
          tenantId,
          subscriptionId: subscription.id,
          actorId,
          reason: "Resiliation demandee par le membre",
          at: now,
        }),
      );
      expect(result.closedAssignments).toBe(1);
      await expect(prisma.groupMember.findFirstOrThrow({
        where: { tenantId, memberId: member.id, groupId: group.id },
      })).resolves.toMatchObject({ status: "INACTIVE" });
    });
  });
});
