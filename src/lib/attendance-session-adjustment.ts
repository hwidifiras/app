import type { AttendanceStatus, Prisma } from "@prisma/client";

import { getRequiredTenantId } from "@/lib/tenant-context";
import { findClassEntitlementForBalance } from "@/lib/subscription-entitlements";

export function statusConsumesSession(
  status: AttendanceStatus,
  absentConsumesSession: boolean,
): boolean {
  if (status === "PRESENT") return true;
  if (status === "ABSENT") return absentConsumesSession;
  return false;
}

/** Positive = credit sessions back; negative = debit sessions */
export function sessionAdjustmentDelta(
  previousStatus: AttendanceStatus,
  nextStatus: AttendanceStatus,
  absentConsumesSession: boolean,
): number {
  const previous = statusConsumesSession(previousStatus, absentConsumesSession) ? 1 : 0;
  const next = statusConsumesSession(nextStatus, absentConsumesSession) ? 1 : 0;
  return previous - next;
}

export async function applySessionBalanceDelta(
  tx: Prisma.TransactionClient,
  params: {
    delta: number;
    memberSubscriptionId: string | null;
    subscriptionEntitlementId?: string | null;
    memberId: string;
    sportId: string;
  },
): Promise<{ memberSubscriptionId: string | null; subscriptionEntitlementId: string | null }> {
  const tenantId = getRequiredTenantId();
  if (params.delta === 0) {
    return {
      memberSubscriptionId: params.memberSubscriptionId,
      subscriptionEntitlementId: params.subscriptionEntitlementId ?? null,
    };
  }

  let subscriptionId = params.memberSubscriptionId;
  let entitlementId = params.subscriptionEntitlementId ?? null;

  if (!subscriptionId && params.delta < 0) {
    const activeEntitlement = await tx.subscriptionEntitlement.findFirst({
      where: {
        tenantId,
        type: "CLASS_SESSIONS",
        sportId: params.sportId,
        remainingUnits: { gt: 0 },
        memberSubscription: { memberId: params.memberId, status: "ACTIVE" },
      },
      select: { id: true, memberSubscriptionId: true },
      orderBy: [{ endDate: "asc" }, { createdAt: "asc" }],
    });
    if (activeEntitlement) {
      subscriptionId = activeEntitlement.memberSubscriptionId;
      entitlementId = activeEntitlement.id;
    }
  }

  const entitlement = subscriptionId
    ? entitlementId
      ? await tx.subscriptionEntitlement.findFirst({
          where: { id: entitlementId, tenantId, memberSubscriptionId: subscriptionId },
          select: {
            id: true,
            remainingUnits: true,
            memberSubscription: { select: { plan: { select: { planKind: true } } } },
          },
        })
      : await findClassEntitlementForBalance(tx, {
          tenantId,
          memberSubscriptionId: subscriptionId,
          sportId: params.sportId,
        })
    : null;

  if (entitlement) entitlementId = entitlement.id;

  if (params.delta > 0) {
    if (!subscriptionId) {
      return { memberSubscriptionId: null, subscriptionEntitlementId: null };
    }
    if (entitlementId) {
      await tx.subscriptionEntitlement.update({
        where: { id: entitlementId },
        data: { remainingUnits: { increment: params.delta } },
      });
    }
    if (!entitlement || entitlement.memberSubscription.plan.planKind === "CLASS") {
      const updated = await tx.memberSubscription.updateMany({
        where: { id: subscriptionId, tenantId },
        data: { remainingSessions: { increment: params.delta } },
      });
      if (updated.count === 0) throw new Error("SUBSCRIPTION_NOT_FOUND");
    }
    return { memberSubscriptionId: subscriptionId, subscriptionEntitlementId: entitlementId };
  }

  if (!subscriptionId) {
    const active = await tx.memberSubscription.findFirst({
      where: {
        tenantId,
        memberId: params.memberId,
        sportId: params.sportId,
        status: "ACTIVE",
        remainingSessions: { gt: 0 },
      },
      select: { id: true },
      orderBy: { endDate: "asc" },
    });
    if (!active) {
      throw new Error("NO_ACTIVE_SUBSCRIPTION");
    }
    subscriptionId = active.id;
  }

  const debit = Math.abs(params.delta);
  if (entitlementId) {
    const entitlementUpdate = await tx.subscriptionEntitlement.updateMany({
      where: { id: entitlementId, tenantId, remainingUnits: { gte: debit } },
      data: { remainingUnits: { decrement: debit } },
    });
    if (entitlementUpdate.count === 0) throw new Error("NO_SESSIONS_LEFT");
  }

  if (!entitlement || entitlement.memberSubscription.plan.planKind === "CLASS") {
    const updated = await tx.memberSubscription.updateMany({
      where: { id: subscriptionId, tenantId, remainingSessions: { gte: debit } },
      data: { remainingSessions: { decrement: debit } },
    });
    if (updated.count === 0) throw new Error("NO_SESSIONS_LEFT");
  }

  return { memberSubscriptionId: subscriptionId, subscriptionEntitlementId: entitlementId };
}
