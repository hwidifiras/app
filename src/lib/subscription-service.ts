import type { Prisma, SubscriptionPlan } from "@prisma/client";

import { computeEndDate } from "@/lib/membership-rules";
import { createSubscriptionEntitlementSnapshots } from "@/lib/subscription-entitlements";

type SubscriptionPlanSnapshot = Pick<
  SubscriptionPlan,
  | "id"
  | "planKind"
  | "sportId"
  | "price"
  | "totalSessions"
  | "validityDays"
  | "activationPolicy"
  | "activationWindowDays"
  | "freezeAllowanceCount"
  | "freezeMaxTotalDays"
>;

export type SubscriptionFromPlanInput = {
  tenantId?: string;
  memberId: string;
  plan: SubscriptionPlanSnapshot;
  startDate: Date;
  amountCents?: number;
  listPriceCents?: number | null;
  discountCents?: number;
  offerApplicationId?: string | null;
  offerName?: string | null;
  carryOverSessions?: number;
  replacesSubscriptionId?: string | null;
};

export function buildSubscriptionData(input: SubscriptionFromPlanInput & { renewsSubscriptionId?: string | null }) {
  const carryOver = Math.max(0, input.carryOverSessions ?? 0);
  const firstUse = input.plan.activationPolicy === "FIRST_USE";
  return {
    ...(input.tenantId ? { tenantId: input.tenantId } : {}),
    memberId: input.memberId,
    planId: input.plan.id,
    sportId: input.plan.sportId,
    startDate: input.startDate,
    endDate: firstUse ? null : computeEndDate(input.startDate, input.plan.validityDays),
    amount: input.amountCents ?? input.plan.price,
    listPriceCents: input.listPriceCents ?? input.plan.price,
    discountCents: input.discountCents ?? 0,
    offerApplicationId: input.offerApplicationId ?? null,
    offerName: input.offerName ?? null,
    remainingSessions: input.plan.planKind === "CLASS" ? input.plan.totalSessions + carryOver : 0,
    status: "ACTIVE" as const,
    activationPolicy: input.plan.activationPolicy,
    activationWindowDays: input.plan.activationWindowDays,
    activationDeadline: firstUse
      ? computeEndDate(input.startDate, input.plan.activationWindowDays)
      : null,
    activatedAt: firstUse ? null : input.startDate,
    freezeAllowanceCount: input.plan.freezeAllowanceCount,
    freezeMaxTotalDays: input.plan.freezeMaxTotalDays,
    renewsSubscriptionId: input.renewsSubscriptionId ?? null,
    replacesSubscriptionId: input.replacesSubscriptionId ?? null,
  };
}

type OverlapCandidate = {
  id: string;
  remainingSessions: number;
  endDate: Date | null;
  renewedBySubscription: { id: string } | null;
};

async function findOverlappingSubscriptions(
  tx: Prisma.TransactionClient,
  input: SubscriptionFromPlanInput,
): Promise<OverlapCandidate[]> {
  const tenantId = input.tenantId;
  if (!tenantId) throw new Error("TENANT_REQUIRED");

  if (input.plan.planKind === "CLASS") {
    if (!input.plan.sportId) throw new Error("CLASS_PLAN_SPORT_REQUIRED");
    return tx.memberSubscription.findMany({
      where: {
        tenantId,
        memberId: input.memberId,
        sportId: input.plan.sportId,
        status: "ACTIVE",
      },
      select: {
        id: true,
        remainingSessions: true,
        endDate: true,
        renewedBySubscription: { select: { id: true } },
      },
      orderBy: [{ endDate: "desc" }, { createdAt: "desc" }],
    });
  }

  const rights = await tx.planEntitlement.findMany({
    where: { tenantId, planId: input.plan.id },
    select: { type: true, sportId: true },
  });
  const sportIds = rights.map((right) => right.sportId).filter((id): id is string => Boolean(id));
  const includesGym = rights.some((right) => right.type === "GYM_ACCESS");
  if (sportIds.length === 0 && !includesGym) throw new Error("PLAN_ENTITLEMENTS_REQUIRED");

  return tx.memberSubscription.findMany({
    where: {
      tenantId,
      memberId: input.memberId,
      status: "ACTIVE",
      entitlements: {
        some: {
          OR: [
            ...(sportIds.length > 0
              ? [{ type: "CLASS_SESSIONS" as const, sportId: { in: sportIds } }]
              : []),
            ...(includesGym ? [{ type: "GYM_ACCESS" as const }] : []),
          ],
        },
      },
    },
    select: {
      id: true,
      remainingSessions: true,
      endDate: true,
      renewedBySubscription: { select: { id: true } },
    },
    orderBy: [{ endDate: "desc" }, { createdAt: "desc" }],
  });
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
    orderBy: { createdAt: "desc" },
  });
  if (!active) return { expiredId: null as string | null, remainingSessions: 0 };

  const updateResult = await tx.memberSubscription.updateMany({
    where: { id: active.id, ...(tenantId ? { tenantId } : {}) },
    data: { status: "EXPIRED" },
  });
  if (updateResult.count !== 1) throw new Error("SUBSCRIPTION_SCOPE_MISMATCH");
  return { expiredId: active.id, remainingSessions: active.remainingSessions };
}

export async function createSubscriptionFromPlan(
  tx: Prisma.TransactionClient,
  input: SubscriptionFromPlanInput,
  options?: { carryOverRemainingSessions?: boolean; now?: Date },
) {
  if (input.plan.planKind === "CLASS" && !input.plan.sportId) throw new Error("CLASS_PLAN_SPORT_REQUIRED");
  if (input.plan.activationPolicy === "FIRST_USE" && input.plan.planKind !== "GYM") {
    throw new Error("FIRST_USE_GYM_ONLY");
  }
  const tenantId = input.tenantId;
  if (!tenantId) throw new Error("TENANT_REQUIRED");
  const now = options?.now ?? new Date();
  const overlapping = await findOverlappingSubscriptions(tx, input);
  const replacementId = input.replacesSubscriptionId ?? null;
  const replacementCandidate = replacementId
    ? overlapping.find((item) => item.id === replacementId) ?? null
    : null;
  if (replacementId && overlapping.some((item) => item.id !== replacementId)) {
    throw new Error("REPLACEMENT_OVERLAP_CONFLICT");
  }
  if (replacementId && !replacementCandidate) {
    throw new Error("SUBSCRIPTION_NOT_REPLACEABLE");
  }
  if (replacementId && options?.carryOverRemainingSessions) {
    throw new Error("REPLACEMENT_CANNOT_CARRY_OVER");
  }

  const predecessor = replacementId ? null : overlapping[0] ?? null;
  const queued = !replacementId && (input.plan.activationPolicy === "FIRST_USE" || input.startDate > now);

  if (queued && predecessor?.renewedBySubscription) throw new Error("RENEWAL_ALREADY_QUEUED");
  if (queued && options?.carryOverRemainingSessions && predecessor?.remainingSessions) {
    throw new Error("CARRY_OVER_REQUIRES_IMMEDIATE_RENEWAL");
  }
  if (!replacementId && !queued && overlapping.length > 0) {
    await tx.memberSubscription.updateMany({
      where: { tenantId, id: { in: overlapping.map((item) => item.id) }, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });
  }

  const carryOver =
    !queued && options?.carryOverRemainingSessions && predecessor && predecessor.remainingSessions > 0
      ? predecessor.remainingSessions
      : 0;
  const subscription = await tx.memberSubscription.create({
    data: buildSubscriptionData({
      ...input,
      carryOverSessions: carryOver,
      renewsSubscriptionId: predecessor?.id ?? null,
    }),
  });
  await createSubscriptionEntitlementSnapshots(tx, {
    tenantId,
    memberSubscriptionId: subscription.id,
    planId: input.plan.id,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
    legacyRemainingSessions: subscription.remainingSessions,
  });
  return subscription;
}
