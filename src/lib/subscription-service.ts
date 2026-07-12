import type { Prisma, SubscriptionPlan } from "@prisma/client";

import { computeEndDate } from "@/lib/membership-rules";
import { createSubscriptionEntitlementSnapshots } from "@/lib/subscription-entitlements";

export type SubscriptionFromPlanInput = {
  tenantId?: string;
  memberId: string;
  plan: Pick<SubscriptionPlan, "id" | "planKind" | "sportId" | "price" | "totalSessions" | "validityDays">;
  startDate: Date;
  amountCents?: number;
  carryOverSessions?: number;
};

export function buildSubscriptionData(input: SubscriptionFromPlanInput) {
  const carryOver = Math.max(0, input.carryOverSessions ?? 0);
  return {
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    memberId: input.memberId,
    planId: input.plan.id,
    sportId: input.plan.sportId,
    startDate: input.startDate,
    endDate: computeEndDate(input.startDate, input.plan.validityDays),
    amount: input.amountCents ?? input.plan.price,
    remainingSessions: input.plan.planKind === "CLASS" ? input.plan.totalSessions + carryOver : 0,
    status: "ACTIVE" as const,
  };
}

export async function expireActiveSubscriptionForSportWithSnapshot(
  tx: Prisma.TransactionClient,
  memberId: string,
  sportId: string,
  tenantId?: string,
) {
  const active = await tx.memberSubscription.findFirst({
    where: { ...(tenantId ? { tenantId } : {}), memberId, sportId, status: "ACTIVE" },
    select: { id: true, remainingSessions: true },
  });

  if (!active) {
    return { expiredId: null as string | null, remainingSessions: 0 };
  }

  const updateResult = await tx.memberSubscription.updateMany({
    where: { id: active.id, ...(tenantId ? { tenantId } : {}) },
    data: { status: "EXPIRED" },
  });
  if (updateResult.count !== 1) {
    throw new Error("SUBSCRIPTION_SCOPE_MISMATCH");
  }

  return { expiredId: active.id, remainingSessions: active.remainingSessions };
}

export async function createSubscriptionFromPlan(
  tx: Prisma.TransactionClient,
  input: SubscriptionFromPlanInput,
  options?: { carryOverRemainingSessions?: boolean },
) {
  if (input.plan.planKind === "CLASS" && !input.plan.sportId) throw new Error("CLASS_PLAN_SPORT_REQUIRED");
  let snapshot = { expiredId: null as string | null, remainingSessions: 0 };
  if (input.plan.planKind === "CLASS" && input.plan.sportId) {
    snapshot = await expireActiveSubscriptionForSportWithSnapshot(tx, input.memberId, input.plan.sportId, input.tenantId);
  } else {
    const tenantId = input.tenantId;
    if (!tenantId) throw new Error("TENANT_REQUIRED");
    const rights = await tx.planEntitlement.findMany({ where: { tenantId, planId: input.plan.id }, select: { type: true, sportId: true } });
    const sportIds = rights.map((right) => right.sportId).filter((id): id is string => Boolean(id));
    const includesGym = rights.some((right) => right.type === "GYM_ACCESS");
    const overlapping = await tx.memberSubscription.findMany({
      where: {
        tenantId,
        memberId: input.memberId,
        status: "ACTIVE",
        entitlements: { some: { OR: [
          ...(sportIds.length > 0 ? [{ type: "CLASS_SESSIONS" as const, sportId: { in: sportIds } }] : []),
          ...(includesGym ? [{ type: "GYM_ACCESS" as const }] : []),
        ] } },
      },
      select: { id: true },
    });
    if (overlapping.length > 0) {
      await tx.memberSubscription.updateMany({ where: { tenantId, id: { in: overlapping.map((item) => item.id) } }, data: { status: "EXPIRED" } });
    }
  }
  const carryOver =
    options?.carryOverRemainingSessions && snapshot.remainingSessions > 0 ? snapshot.remainingSessions : 0;

  const subscription = await tx.memberSubscription.create({
    data: buildSubscriptionData({
      ...input,
      carryOverSessions: carryOver,
    }),
  });
  await createSubscriptionEntitlementSnapshots(tx, {
    tenantId: input.tenantId ?? subscription.tenantId ?? "",
    memberSubscriptionId: subscription.id,
    planId: input.plan.id,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    legacyRemainingSessions: subscription.remainingSessions,
  });
  return subscription;
}
