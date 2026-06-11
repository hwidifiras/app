import type { AttendanceStatus, Prisma } from "@prisma/client";

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
    memberId: string;
    sportId: string;
  },
): Promise<{ memberSubscriptionId: string | null }> {
  if (params.delta === 0) {
    return { memberSubscriptionId: params.memberSubscriptionId };
  }

  let subscriptionId = params.memberSubscriptionId;

  if (params.delta > 0) {
    if (!subscriptionId) {
      return { memberSubscriptionId: null };
    }
    await tx.memberSubscription.update({
      where: { id: subscriptionId },
      data: { remainingSessions: { increment: params.delta } },
    });
    return { memberSubscriptionId: subscriptionId };
  }

  if (!subscriptionId) {
    const active = await tx.memberSubscription.findFirst({
      where: {
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

  const updated = await tx.memberSubscription.updateMany({
    where: { id: subscriptionId, remainingSessions: { gt: 0 } },
    data: { remainingSessions: { decrement: Math.abs(params.delta) } },
  });

  if (updated.count === 0) {
    throw new Error("NO_SESSIONS_LEFT");
  }

  return { memberSubscriptionId: subscriptionId };
}
