import type { Prisma, SubscriptionPlan } from "@prisma/client";

import { computeEndDate } from "@/lib/membership-rules";

export type SubscriptionFromPlanInput = {
  tenantId?: string;
  memberId: string;
  plan: Pick<SubscriptionPlan, "id" | "sportId" | "price" | "totalSessions" | "validityDays">;
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
    remainingSessions: input.plan.totalSessions + carryOver,
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
  if (!input.plan.sportId) {
    throw new Error("CLASS_PLAN_SPORT_REQUIRED");
  }
  const snapshot = await expireActiveSubscriptionForSportWithSnapshot(
    tx,
    input.memberId,
    input.plan.sportId,
    input.tenantId,
  );
  const carryOver =
    options?.carryOverRemainingSessions && snapshot.remainingSessions > 0 ? snapshot.remainingSessions : 0;

  return tx.memberSubscription.create({
    data: buildSubscriptionData({
      ...input,
      carryOverSessions: carryOver,
    }),
  });
}
