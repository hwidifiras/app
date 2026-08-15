import type { Prisma } from "@prisma/client";

import { computeEndDate } from "@/lib/membership-rules";
import {
  findOpenPauseAt,
  resolveSubscriptionEffectiveState,
  totalPauseSeconds,
} from "@/modules/sales/subscription-lifecycle";

type TransactionClient = Prisma.TransactionClient;

function addSeconds(value: Date, seconds: number) {
  return new Date(value.getTime() + seconds * 1000);
}

async function writeLifecycleAudit(
  tx: TransactionClient,
  input: {
    tenantId: string;
    action: string;
    subscriptionId: string;
    actorId?: string | null;
    details: Record<string, unknown>;
  },
) {
  await tx.auditLog.create({
    data: {
      tenantId: input.tenantId,
      action: input.action,
      entityType: "MemberSubscription",
      entityId: input.subscriptionId,
      userId: input.actorId ?? null,
      details: JSON.stringify({ tenantId: input.tenantId, ...input.details }),
    },
  });
}

export async function synchronizeDueRenewals(
  tx: TransactionClient,
  input: { tenantId: string; memberId: string; at?: Date },
) {
  const at = input.at ?? new Date();
  const due = await tx.memberSubscription.findMany({
    where: {
      tenantId: input.tenantId,
      memberId: input.memberId,
      status: "ACTIVE",
      activationPolicy: "FIXED_DATE",
      startDate: { lte: at },
      renewsSubscriptionId: { not: null },
    },
    select: { renewsSubscriptionId: true },
  });
  const predecessorIds = due
    .map((item) => item.renewsSubscriptionId)
    .filter((id): id is string => Boolean(id));
  if (predecessorIds.length === 0) return 0;

  const result = await tx.memberSubscription.updateMany({
    where: { tenantId: input.tenantId, id: { in: predecessorIds }, status: "ACTIVE" },
    data: { status: "EXPIRED" },
  });
  return result.count;
}

export async function activateFirstUseSubscription(
  tx: TransactionClient,
  input: {
    tenantId: string;
    subscriptionId: string;
    actorId?: string | null;
    at?: Date;
    reason?: string;
  },
) {
  const at = input.at ?? new Date();
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.tenantId}:subscription:${input.subscriptionId}`}))`;
  const subscription = await tx.memberSubscription.findFirst({
    where: { tenantId: input.tenantId, id: input.subscriptionId },
    include: {
      plan: { select: { validityDays: true, planKind: true } },
      entitlements: true,
    },
  });
  if (!subscription) throw new Error("SUBSCRIPTION_NOT_FOUND");
  if (subscription.activationPolicy !== "FIRST_USE" || subscription.plan.planKind !== "GYM") {
    throw new Error("FIRST_USE_GYM_ONLY");
  }
  if (subscription.status !== "ACTIVE") throw new Error("SUBSCRIPTION_INACTIVE");
  if (subscription.activatedAt) return subscription;
  if (subscription.activationDeadline && subscription.activationDeadline < at) {
    throw new Error("ACTIVATION_WINDOW_EXPIRED");
  }

  const endDate = computeEndDate(at, subscription.plan.validityDays);
  const updated = await tx.memberSubscription.update({
    where: { id: subscription.id },
    data: { activatedAt: at, startDate: at, endDate },
  });

  for (const entitlement of subscription.entitlements) {
    await tx.subscriptionEntitlement.update({
      where: { id: entitlement.id },
      data: { startDate: at, endDate },
    });
    await tx.entitlementAdjustment.create({
      data: {
        tenantId: input.tenantId,
        memberSubscriptionId: subscription.id,
        subscriptionEntitlementId: entitlement.id,
        kind: "ACTIVATION",
        previousStartDate: entitlement.startDate,
        nextStartDate: at,
        previousEndDate: entitlement.endDate,
        nextEndDate: endDate,
        reason: input.reason?.trim() || "Activation au premier passage",
        createdById: input.actorId ?? null,
      },
    });
  }

  if (subscription.renewsSubscriptionId) {
    await tx.memberSubscription.updateMany({
      where: { tenantId: input.tenantId, id: subscription.renewsSubscriptionId, status: "ACTIVE" },
      data: { status: "EXPIRED" },
    });
  }

  await writeLifecycleAudit(tx, {
    tenantId: input.tenantId,
    action: "SUBSCRIPTION_FIRST_USE_ACTIVATED",
    subscriptionId: subscription.id,
    actorId: input.actorId,
    details: {
      activatedAt: at.toISOString(),
      endDate: endDate.toISOString(),
      renewsSubscriptionId: subscription.renewsSubscriptionId,
    },
  });
  return updated;
}

export async function pauseSubscription(
  tx: TransactionClient,
  input: {
    tenantId: string;
    subscriptionId: string;
    actorId: string;
    reason: string;
    at?: Date;
  },
) {
  const at = input.at ?? new Date();
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.tenantId}:subscription:${input.subscriptionId}`}))`;
  const subscription = await tx.memberSubscription.findFirst({
    where: { tenantId: input.tenantId, id: input.subscriptionId },
    include: { pauseEvents: { orderBy: { effectiveAt: "asc" } }, renewedBySubscription: true },
  });
  if (!subscription) throw new Error("SUBSCRIPTION_NOT_FOUND");
  if (
    subscription.renewedBySubscription &&
    !["CANCELLED", "EXPIRED"].includes(subscription.renewedBySubscription.status)
  ) {
    throw new Error("SUBSCRIPTION_HAS_QUEUED_RENEWAL");
  }
  if (subscription.freezeAllowanceCount <= 0 || subscription.freezeMaxTotalDays <= 0) {
    throw new Error("FREEZE_NOT_ALLOWED");
  }
  if (findOpenPauseAt(subscription.pauseEvents, at)) throw new Error("SUBSCRIPTION_ALREADY_FROZEN");
  if (resolveSubscriptionEffectiveState(subscription, at) !== "ACTIVE") {
    throw new Error("SUBSCRIPTION_NOT_ACTIVE");
  }
  const usedPauses = subscription.pauseEvents.filter((event) => event.entryType === "PAUSE").length;
  if (usedPauses >= subscription.freezeAllowanceCount) throw new Error("FREEZE_COUNT_EXHAUSTED");
  if (totalPauseSeconds(subscription.pauseEvents) >= subscription.freezeMaxTotalDays * 86_400) {
    throw new Error("FREEZE_DAYS_EXHAUSTED");
  }

  const pause = await tx.subscriptionPause.create({
    data: {
      tenantId: input.tenantId,
      memberSubscriptionId: subscription.id,
      entryType: "PAUSE",
      effectiveAt: at,
      reason: input.reason.trim(),
      createdById: input.actorId,
    },
  });
  await writeLifecycleAudit(tx, {
    tenantId: input.tenantId,
    action: "SUBSCRIPTION_PAUSED",
    subscriptionId: subscription.id,
    actorId: input.actorId,
    details: { pauseEventId: pause.id, pausedAt: at.toISOString(), reason: input.reason.trim() },
  });
  return pause;
}

export async function resumeSubscription(
  tx: TransactionClient,
  input: {
    tenantId: string;
    subscriptionId: string;
    actorId: string;
    reason: string;
    at?: Date;
  },
) {
  const at = input.at ?? new Date();
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.tenantId}:subscription:${input.subscriptionId}`}))`;
  const subscription = await tx.memberSubscription.findFirst({
    where: { tenantId: input.tenantId, id: input.subscriptionId },
    include: {
      pauseEvents: { orderBy: { effectiveAt: "asc" } },
      entitlements: true,
    },
  });
  if (!subscription) throw new Error("SUBSCRIPTION_NOT_FOUND");
  const openPause = findOpenPauseAt(subscription.pauseEvents, at);
  if (!openPause) throw new Error("SUBSCRIPTION_NOT_FROZEN");
  const actualDurationSeconds = Math.max(0, Math.floor((at.getTime() - openPause.effectiveAt.getTime()) / 1000));
  const usedDurationSeconds = totalPauseSeconds(subscription.pauseEvents);
  const remainingAllowanceSeconds = Math.max(
    0,
    subscription.freezeMaxTotalDays * 86_400 - usedDurationSeconds,
  );
  const durationSeconds = Math.min(actualDurationSeconds, remainingAllowanceSeconds);

  const previousEndDate = subscription.endDate;
  const nextEndDate = previousEndDate ? addSeconds(previousEndDate, durationSeconds) : null;
  const resume = await tx.subscriptionPause.create({
    data: {
      tenantId: input.tenantId,
      memberSubscriptionId: subscription.id,
      entryType: "RESUME",
      pauseEventId: openPause.id,
      effectiveAt: at,
      durationSeconds,
      reason: input.reason.trim(),
      createdById: input.actorId,
    },
  });

  await tx.memberSubscription.update({
    where: { id: subscription.id },
    data: { endDate: nextEndDate },
  });
  for (const entitlement of subscription.entitlements) {
    const entitlementEndDate = entitlement.endDate ? addSeconds(entitlement.endDate, durationSeconds) : null;
    await tx.subscriptionEntitlement.update({
      where: { id: entitlement.id },
      data: { endDate: entitlementEndDate },
    });
    await tx.entitlementAdjustment.create({
      data: {
        tenantId: input.tenantId,
        memberSubscriptionId: subscription.id,
        subscriptionEntitlementId: entitlement.id,
        kind: "EXPIRY",
        endDateDeltaSeconds: durationSeconds,
        previousEndDate: entitlement.endDate,
        nextEndDate: entitlementEndDate,
        reason: input.reason.trim(),
        createdById: input.actorId,
      },
    });
  }

  if (previousEndDate && nextEndDate) {
    const classSportIds = subscription.entitlements
      .filter((entitlement) => entitlement.type === "CLASS_SESSIONS" && entitlement.sportId)
      .map((entitlement) => entitlement.sportId as string);
    if (classSportIds.length > 0) {
      await tx.groupMember.updateMany({
        where: {
          tenantId: input.tenantId,
          memberId: subscription.memberId,
          status: "ACTIVE",
          endDate: previousEndDate,
          group: { sportId: { in: classSportIds } },
        },
        data: { endDate: nextEndDate },
      });
    }
  }

  await writeLifecycleAudit(tx, {
    tenantId: input.tenantId,
    action: "SUBSCRIPTION_RESUMED",
    subscriptionId: subscription.id,
    actorId: input.actorId,
    details: {
      pauseEventId: openPause.id,
      resumeEventId: resume.id,
      resumedAt: at.toISOString(),
      durationSeconds,
      actualDurationSeconds,
      extensionCapped: durationSeconds < actualDurationSeconds,
      previousEndDate: previousEndDate?.toISOString() ?? null,
      nextEndDate: nextEndDate?.toISOString() ?? null,
      reason: input.reason.trim(),
    },
  });
  return { resume, nextEndDate };
}

export async function adjustEntitlementUnits(
  tx: TransactionClient,
  input: {
    tenantId: string;
    subscriptionId: string;
    entitlementId: string;
    unitsDelta: number;
    actorId: string;
    reason: string;
  },
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.tenantId}:entitlement:${input.entitlementId}`}))`;
  const entitlement = await tx.subscriptionEntitlement.findFirst({
    where: {
      tenantId: input.tenantId,
      id: input.entitlementId,
      memberSubscriptionId: input.subscriptionId,
    },
    include: { memberSubscription: { select: { status: true, plan: { select: { planKind: true } } } } },
  });
  if (!entitlement) throw new Error("ENTITLEMENT_NOT_FOUND");
  if (entitlement.memberSubscription.status === "CANCELLED") throw new Error("SUBSCRIPTION_CANCELLED");
  if (entitlement.remainingUnits === null) throw new Error("UNLIMITED_ENTITLEMENT");
  const nextRemainingUnits = entitlement.remainingUnits + input.unitsDelta;
  if (nextRemainingUnits < 0) throw new Error("NEGATIVE_ENTITLEMENT_BALANCE");

  await tx.subscriptionEntitlement.update({
    where: { id: entitlement.id },
    data: { remainingUnits: nextRemainingUnits },
  });
  if (entitlement.type === "CLASS_SESSIONS" && entitlement.memberSubscription.plan.planKind === "CLASS") {
    await tx.memberSubscription.update({
      where: { id: input.subscriptionId },
      data: { remainingSessions: nextRemainingUnits },
    });
  }
  const adjustment = await tx.entitlementAdjustment.create({
    data: {
      tenantId: input.tenantId,
      memberSubscriptionId: input.subscriptionId,
      subscriptionEntitlementId: entitlement.id,
      kind: "UNITS",
      unitsDelta: input.unitsDelta,
      previousRemainingUnits: entitlement.remainingUnits,
      nextRemainingUnits,
      reason: input.reason.trim(),
      createdById: input.actorId,
    },
  });
  await writeLifecycleAudit(tx, {
    tenantId: input.tenantId,
    action: "SUBSCRIPTION_ENTITLEMENT_ADJUSTED",
    subscriptionId: input.subscriptionId,
    actorId: input.actorId,
    details: {
      adjustmentId: adjustment.id,
      entitlementId: entitlement.id,
      unitsDelta: input.unitsDelta,
      previousRemainingUnits: entitlement.remainingUnits,
      nextRemainingUnits,
      reason: input.reason.trim(),
    },
  });
  return { adjustment, nextRemainingUnits };
}

export async function cancelSubscription(
  tx: TransactionClient,
  input: {
    tenantId: string;
    subscriptionId: string;
    actorId: string;
    reason: string;
    at?: Date;
  },
) {
  const at = input.at ?? new Date();
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.tenantId}:subscription:${input.subscriptionId}`}))`;
  const subscription = await tx.memberSubscription.findFirst({
    where: { tenantId: input.tenantId, id: input.subscriptionId },
    include: {
      entitlements: { select: { type: true, sportId: true } },
      renewedBySubscription: { select: { id: true, status: true } },
    },
  });
  if (!subscription) throw new Error("SUBSCRIPTION_NOT_FOUND");
  if (subscription.status === "CANCELLED") throw new Error("SUBSCRIPTION_ALREADY_CANCELLED");
  if (
    subscription.renewedBySubscription &&
    !["CANCELLED", "EXPIRED"].includes(subscription.renewedBySubscription.status)
  ) {
    throw new Error("SUBSCRIPTION_HAS_QUEUED_RENEWAL");
  }

  const updated = await tx.memberSubscription.update({
    where: { id: subscription.id },
    data: { status: "CANCELLED" },
  });

  const classSportIds = [...new Set(
    subscription.entitlements
      .filter((right) => right.type === "CLASS_SESSIONS" && right.sportId)
      .map((right) => right.sportId as string),
  )];
  let closedAssignments = 0;
  for (const sportId of classSportIds) {
    const anotherCurrentRight = await tx.subscriptionEntitlement.findFirst({
      where: {
        tenantId: input.tenantId,
        type: "CLASS_SESSIONS",
        sportId,
        memberSubscriptionId: { not: subscription.id },
        memberSubscription: {
          tenantId: input.tenantId,
          memberId: subscription.memberId,
          status: "ACTIVE",
          startDate: { lte: at },
          OR: [{ endDate: null }, { endDate: { gte: at } }],
        },
      },
      select: { id: true },
    });
    if (anotherCurrentRight) continue;

    const result = await tx.groupMember.updateMany({
      where: {
        tenantId: input.tenantId,
        memberId: subscription.memberId,
        status: "ACTIVE",
        group: { sportId },
      },
      data: { status: "INACTIVE", endDate: at },
    });
    closedAssignments += result.count;
  }

  await writeLifecycleAudit(tx, {
    tenantId: input.tenantId,
    action: "MEMBER_SUBSCRIPTION_CANCELLED",
    subscriptionId: subscription.id,
    actorId: input.actorId,
    details: {
      cancelledAt: at.toISOString(),
      reason: input.reason.trim(),
      previousStatus: subscription.status,
      nextStatus: updated.status,
      closedAssignments,
    },
  });
  return { subscription: updated, closedAssignments };
}
