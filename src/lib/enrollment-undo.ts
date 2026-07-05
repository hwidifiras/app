import type { GroupMemberStatus, Prisma } from "@prisma/client";
import { z } from "zod";

import { getEffectivePaymentAmount } from "@/lib/payment-ledger";
import { voidReceiptForPayment } from "@/lib/receipts";

export class EnrollmentRevertBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnrollmentRevertBlockedError";
  }
}

export const enrollmentUndoSnapshotSchema = z.object({
  createdMemberIds: z.array(z.string()),
  createdSubscriptionIds: z.array(z.string()),
  createdPaymentIds: z.array(z.string()),
  createdGroupMemberIds: z.array(z.string()),
  reactivatedGroupMembers: z.array(
    z.object({
      id: z.string(),
      previousStatus: z.custom<GroupMemberStatus>(),
      previousStartDate: z.string(),
      previousEndDate: z.string().nullable(),
    }),
  ),
  expiredSubscriptionIds: z.array(z.string()),
  offerApplicationId: z.string().nullable(),
});

export type EnrollmentUndoSnapshot = z.infer<typeof enrollmentUndoSnapshotSchema>;

export function emptyEnrollmentUndoSnapshot(): EnrollmentUndoSnapshot {
  return {
    createdMemberIds: [],
    createdSubscriptionIds: [],
    createdPaymentIds: [],
    createdGroupMemberIds: [],
    reactivatedGroupMembers: [],
    expiredSubscriptionIds: [],
    offerApplicationId: null,
  };
}

async function ensureNoAttendanceForSnapshot(
  tx: Prisma.TransactionClient,
  snapshot: EnrollmentUndoSnapshot,
  tenantId?: string | null,
) {
  if (snapshot.createdSubscriptionIds.length > 0) {
    const attendanceCount = await tx.attendance.count({
      where: {
        ...(tenantId ? { tenantId } : {}),
        memberSubscriptionId: { in: snapshot.createdSubscriptionIds },
      },
    });
    if (attendanceCount > 0) {
      throw new EnrollmentRevertBlockedError(
        "Annulation impossible: des pointages existent sur les abonnements crees.",
      );
    }
  }

  if (snapshot.createdMemberIds.length > 0) {
    const attendanceCount = await tx.attendance.count({
      where: {
        ...(tenantId ? { tenantId } : {}),
        memberId: { in: snapshot.createdMemberIds },
      },
    });
    if (attendanceCount > 0) {
      throw new EnrollmentRevertBlockedError(
        "Annulation impossible: des pointages existent pour les membres inscrits.",
      );
    }
  }
}

export async function getEnrollmentRevertBlockReason(
  tx: Prisma.TransactionClient,
  snapshot: EnrollmentUndoSnapshot,
  tenantId?: string | null,
): Promise<string | null> {
  try {
    await ensureNoAttendanceForSnapshot(tx, snapshot, tenantId);
    return null;
  } catch (error) {
    if (error instanceof EnrollmentRevertBlockedError) {
      return error.message;
    }
    throw error;
  }
}

async function reverseCreatedPayments(
  tx: Prisma.TransactionClient,
  snapshot: EnrollmentUndoSnapshot,
  actorId: string,
  now: Date,
  reason: string,
  tenantId?: string | null,
) {
  if (snapshot.createdPaymentIds.length === 0) return;

  const payments = await tx.payment.findMany({
    where: { ...(tenantId ? { tenantId } : {}), id: { in: snapshot.createdPaymentIds } },
    select: {
      id: true,
      memberSubscriptionId: true,
      paymentMethod: true,
      notes: true,
      entryType: true,
    },
  });

  for (const payment of payments) {
    if (payment.entryType !== "PAYMENT") continue;
    const effectiveAmount = await getEffectivePaymentAmount(tx, payment.id);
    if (effectiveAmount <= 0) continue;

    const reversal = await tx.payment.create({
      data: {
        tenantId: tenantId ?? undefined,
        memberSubscriptionId: payment.memberSubscriptionId,
        amount: -effectiveAmount,
        entryType: "REVERSAL",
        correctsPaymentId: payment.id,
        correctionReason: reason,
        createdById: actorId,
        paymentDate: now,
        paymentMethod: payment.paymentMethod,
        notes: payment.notes,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId: tenantId ?? undefined,
        action: "PAYMENT_REVERSED",
        entityType: "Payment",
        entityId: reversal.id,
        userId: actorId,
        details: JSON.stringify({
          tenantId: tenantId ?? null,
          originalPaymentId: payment.id,
          reason,
          reversedAmount: effectiveAmount,
          source: "enrollment-void",
        }),
      },
    });

    const voidedReceipt = await voidReceiptForPayment(tx, payment.id, reason, tenantId);
    if (voidedReceipt) {
      await tx.auditLog.create({
        data: {
          tenantId: tenantId ?? undefined,
          action: "RECEIPT_VOIDED",
          entityType: "Receipt",
          entityId: voidedReceipt.id,
          userId: actorId,
          details: JSON.stringify({
            tenantId: tenantId ?? null,
            paymentId: payment.id,
            reason,
            source: "enrollment-void",
          }),
        },
      });
    }
  }
}

export async function revertEnrollmentUndoSnapshot(
  tx: Prisma.TransactionClient,
  snapshot: EnrollmentUndoSnapshot,
  actorId: string,
  reason = "Annulation inscription",
  options: { tenantId?: string | null; recoveryKey?: string | null; memberIds?: string[] } = {},
): Promise<void> {
  const now = new Date();

  await ensureNoAttendanceForSnapshot(tx, snapshot, options.tenantId);
  await reverseCreatedPayments(tx, snapshot, actorId, now, reason, options.tenantId);

  if (snapshot.offerApplicationId) {
    await tx.memberSubscription.updateMany({
      where: {
        ...(options.tenantId ? { tenantId: options.tenantId } : {}),
        offerApplicationId: snapshot.offerApplicationId,
      },
      data: { offerApplicationId: null },
    });
  }

  if (snapshot.createdSubscriptionIds.length > 0) {
    await tx.memberSubscription.updateMany({
      where: {
        ...(options.tenantId ? { tenantId: options.tenantId } : {}),
        id: { in: snapshot.createdSubscriptionIds },
      },
      data: { status: "CANCELLED" },
    });
  }

  if (snapshot.expiredSubscriptionIds.length > 0) {
    await tx.memberSubscription.updateMany({
      where: {
        ...(options.tenantId ? { tenantId: options.tenantId } : {}),
        id: { in: snapshot.expiredSubscriptionIds },
        status: "EXPIRED",
      },
      data: { status: "ACTIVE" },
    });
  }

  if (snapshot.createdGroupMemberIds.length > 0) {
    await tx.groupMember.updateMany({
      where: {
        ...(options.tenantId ? { tenantId: options.tenantId } : {}),
        id: { in: snapshot.createdGroupMemberIds },
      },
      data: { status: "INACTIVE", endDate: now },
    });
  }

  for (const item of snapshot.reactivatedGroupMembers) {
    await tx.groupMember.updateMany({
      where: { ...(options.tenantId ? { tenantId: options.tenantId } : {}), id: item.id },
      data: {
        status: item.previousStatus,
        startDate: new Date(item.previousStartDate),
        endDate: item.previousEndDate ? new Date(item.previousEndDate) : null,
      },
    });
  }

  if (snapshot.createdMemberIds.length > 0) {
    await tx.member.updateMany({
      where: {
        ...(options.tenantId ? { tenantId: options.tenantId } : {}),
        id: { in: snapshot.createdMemberIds },
      },
      data: { status: "ARCHIVED", archivedAt: now },
    });
  }

  await tx.auditLog.create({
    data: {
      tenantId: options.tenantId ?? undefined,
      action: "ENROLLMENT_VOIDED",
      entityType: "Enrollment",
      entityId: snapshot.offerApplicationId ?? snapshot.createdMemberIds[0] ?? "batch",
      userId: actorId,
      details: JSON.stringify({
        tenantId: options.tenantId ?? null,
        ...snapshot,
        memberIds: options.memberIds ?? snapshot.createdMemberIds,
        recoveryKey: options.recoveryKey ?? null,
        reason,
        voidedAt: now.toISOString(),
        mode: "traceable-void",
      }),
    },
  });
}
