import type { GroupMemberStatus, Prisma } from "@prisma/client";
import { z } from "zod";

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

export async function revertEnrollmentUndoSnapshot(
  tx: Prisma.TransactionClient,
  snapshot: EnrollmentUndoSnapshot,
  actorId: string,
): Promise<void> {
  if (snapshot.createdSubscriptionIds.length > 0) {
    const attendanceCount = await tx.attendance.count({
      where: { memberSubscriptionId: { in: snapshot.createdSubscriptionIds } },
    });
    if (attendanceCount > 0) {
      throw new EnrollmentRevertBlockedError(
        "Annulation impossible : des pointages existent sur les abonnements créés.",
      );
    }
  }

  if (snapshot.createdMemberIds.length > 0) {
    const attendanceCount = await tx.attendance.count({
      where: { memberId: { in: snapshot.createdMemberIds } },
    });
    if (attendanceCount > 0) {
      throw new EnrollmentRevertBlockedError(
        "Annulation impossible : des pointages existent pour les membres inscrits.",
      );
    }
  }

  if (snapshot.offerApplicationId) {
    await tx.memberSubscription.updateMany({
      where: { offerApplicationId: snapshot.offerApplicationId },
      data: { offerApplicationId: null },
    });
    await tx.offerApplication.delete({ where: { id: snapshot.offerApplicationId } });
  }

  if (snapshot.createdPaymentIds.length > 0) {
    await tx.payment.deleteMany({ where: { id: { in: snapshot.createdPaymentIds } } });
  }

  if (snapshot.createdSubscriptionIds.length > 0) {
    await tx.memberSubscription.deleteMany({ where: { id: { in: snapshot.createdSubscriptionIds } } });
  }

  if (snapshot.expiredSubscriptionIds.length > 0) {
    await tx.memberSubscription.updateMany({
      where: { id: { in: snapshot.expiredSubscriptionIds }, status: "EXPIRED" },
      data: { status: "ACTIVE" },
    });
  }

  if (snapshot.createdGroupMemberIds.length > 0) {
    await tx.groupMember.deleteMany({ where: { id: { in: snapshot.createdGroupMemberIds } } });
  }

  for (const item of snapshot.reactivatedGroupMembers) {
    await tx.groupMember.update({
      where: { id: item.id },
      data: {
        status: item.previousStatus,
        startDate: new Date(item.previousStartDate),
        endDate: item.previousEndDate ? new Date(item.previousEndDate) : null,
      },
    });
  }

  if (snapshot.createdMemberIds.length > 0) {
    for (const memberId of snapshot.createdMemberIds) {
      const subCount = await tx.memberSubscription.count({ where: { memberId } });
      const groupCount = await tx.groupMember.count({ where: { memberId } });
      if (subCount > 0 || groupCount > 0) {
        throw new EnrollmentRevertBlockedError(
          "Annulation impossible : un membre créé est encore lié à l'inscription.",
        );
      }
    }

    await tx.member.deleteMany({ where: { id: { in: snapshot.createdMemberIds } } });
  }

  await tx.auditLog.create({
    data: {
      action: "ENROLLMENT_REVERTED",
      entityType: "Enrollment",
      entityId: snapshot.offerApplicationId ?? snapshot.createdMemberIds[0] ?? "batch",
      userId: actorId,
      details: JSON.stringify(snapshot),
    },
  });
}
