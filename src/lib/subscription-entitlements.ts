import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getRequiredTenantId } from "@/lib/tenant-context";

type TransactionClient = Prisma.TransactionClient;

export async function createSubscriptionEntitlementSnapshots(
  tx: TransactionClient,
  params: {
    tenantId: string;
    memberSubscriptionId: string;
    planId: string;
    startDate: Date;
    endDate: Date | null;
    legacyRemainingSessions: number;
  },
) {
  const plan = await tx.subscriptionPlan.findFirst({
    where: { id: params.planId, tenantId: params.tenantId },
    include: { entitlements: { orderBy: { sortOrder: "asc" } } },
  });
  if (!plan) throw new Error("PLAN_NOT_FOUND");

  const definitions =
    plan.entitlements.length > 0
      ? plan.entitlements
      : plan.planKind === "CLASS" && plan.sportId
        ? [
            {
              id: null,
              type: "CLASS_SESSIONS" as const,
              sportId: plan.sportId,
              sessionsPerWeek: plan.sessionsPerWeek,
              grantedUnits: plan.totalSessions,
              gymAccessMode: null,
            },
          ]
        : [];

  if (definitions.length === 0) throw new Error("PLAN_ENTITLEMENTS_REQUIRED");

  return Promise.all(
    definitions.map((definition) =>
      tx.subscriptionEntitlement.create({
        data: {
          tenantId: params.tenantId,
          memberSubscriptionId: params.memberSubscriptionId,
          planEntitlementId: definition.id,
          type: definition.type,
          sportId: definition.sportId,
          sessionsPerWeek: definition.sessionsPerWeek,
          grantedUnits: definition.grantedUnits,
          remainingUnits:
            definition.type === "CLASS_SESSIONS"
              ? plan.planKind === "CLASS"
                ? params.legacyRemainingSessions
                : definition.grantedUnits
              : definition.gymAccessMode === "VISIT_QUOTA"
                ? definition.grantedUnits
                : null,
          gymAccessMode: definition.gymAccessMode,
          startDate: params.startDate,
          endDate: params.endDate,
        },
      }),
    ),
  );
}

export async function resolveClassEntitlementForAttendance(
  memberId: string,
  sportId: string,
  sessionDate: Date,
) {
  const tenantId = getRequiredTenantId();
  const dayStart = new Date(sessionDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const nextDay = new Date(dayStart);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  return prisma.subscriptionEntitlement.findFirst({
    where: {
      tenantId,
      type: "CLASS_SESSIONS",
      sportId,
      remainingUnits: { gt: 0 },
      startDate: { lt: nextDay },
      OR: [{ endDate: null }, { endDate: { gte: dayStart } }],
      memberSubscription: {
        tenantId,
        memberId,
        status: { in: ["ACTIVE", "EXPIRED"] },
      },
    },
    select: {
      id: true,
      sportId: true,
      remainingUnits: true,
      sessionsPerWeek: true,
      memberSubscription: {
        select: {
          id: true,
          amount: true,
          payments: { select: { amount: true } },
          plan: { select: { name: true, sportId: true, sessionsPerWeek: true } },
        },
      },
    },
    orderBy: [{ endDate: "asc" }, { createdAt: "asc" }],
  });
}

export async function findClassEntitlementForBalance(
  tx: TransactionClient,
  params: { tenantId: string; memberSubscriptionId: string; sportId: string },
) {
  return tx.subscriptionEntitlement.findFirst({
    where: {
      tenantId: params.tenantId,
      memberSubscriptionId: params.memberSubscriptionId,
      type: "CLASS_SESSIONS",
      sportId: params.sportId,
    },
    select: {
      id: true,
      remainingUnits: true,
      memberSubscription: { select: { plan: { select: { planKind: true } } } },
    },
  });
}
