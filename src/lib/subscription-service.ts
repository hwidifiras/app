import type { Prisma, SubscriptionPlan } from "@prisma/client";

import { computeEndDate } from "@/lib/membership-rules";

export type SubscriptionFromPlanInput = {
  memberId: string;
  plan: Pick<SubscriptionPlan, "id" | "sportId" | "price" | "totalSessions" | "validityDays">;
  startDate: Date;
  amountCents?: number;
  carryOverSessions?: number;
};

export function buildSubscriptionData(input: SubscriptionFromPlanInput) {
  const carryOver = Math.max(0, input.carryOverSessions ?? 0);
  return {
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
) {
  const active = await tx.memberSubscription.findFirst({
    where: { memberId, sportId, status: "ACTIVE" },
    select: { id: true, remainingSessions: true },
  });

  if (!active) {
    return { expiredId: null as string | null, remainingSessions: 0 };
  }

  await tx.memberSubscription.update({
    where: { id: active.id },
    data: { status: "EXPIRED" },
  });

  return { expiredId: active.id, remainingSessions: active.remainingSessions };
}

export async function createSubscriptionFromPlan(
  tx: Prisma.TransactionClient,
  input: SubscriptionFromPlanInput,
  options?: { carryOverRemainingSessions?: boolean },
) {
  const snapshot = await expireActiveSubscriptionForSportWithSnapshot(tx, input.memberId, input.plan.sportId);
  const carryOver =
    options?.carryOverRemainingSessions && snapshot.remainingSessions > 0 ? snapshot.remainingSessions : 0;

  return tx.memberSubscription.create({
    data: buildSubscriptionData({
      ...input,
      carryOverSessions: carryOver,
    }),
  });
}
