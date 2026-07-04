import type { SessionStatus } from "@prisma/client";

import { findActiveAssignmentOnDate } from "@/lib/assignment-policy";
import {
  canCheckInWithPayment,
  resolveSubscriptionForAttendance,
  type ActiveSubscriptionView,
} from "@/lib/membership-rules";
import { prisma } from "@/lib/prisma";

export type AttendancePolicyFailure = {
  status: number;
  body: {
    error: string;
    code?: string;
    count?: number;
  };
};

export function sessionMutationFailure(
  status: SessionStatus,
  action: "pointer" | "corriger" | "annuler",
): AttendancePolicyFailure | null {
  if (status === "CANCELLED") {
    return {
      status: 409,
      body: {
        error: `Impossible de ${action} une seance annulee`,
        code: "SESSION_CANCELLED",
      },
    };
  }

  if (status === "COMPLETED") {
    return {
      status: 409,
      body: {
        error: `Cette seance est finalisee. Rouvrez-la avant de ${action} le pointage.`,
        code: "SESSION_REOPEN_REQUIRED",
      },
    };
  }

  return null;
}

export async function activeMemberFailure(memberId: string): Promise<AttendancePolicyFailure | null> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { status: true },
  });

  if (!member) {
    return { status: 404, body: { error: "Membre introuvable" } };
  }

  if (member.status !== "ACTIVE") {
    return {
      status: 403,
      body: {
        error: "Impossible de pointer un membre resilie",
        code: "MEMBER_ARCHIVED",
      },
    };
  }

  return null;
}

export async function assignmentFailure(
  groupId: string,
  memberId: string,
  sessionDate: Date,
): Promise<AttendancePolicyFailure | null> {
  const assignment = await findActiveAssignmentOnDate(groupId, memberId, sessionDate);

  if (!assignment) {
    return {
      status: 403,
      body: {
        error: "Le membre n'est pas assigne a ce groupe a la date de la seance - passage exceptionnel requis",
        code: "NOT_ASSIGNED_TO_GROUP",
      },
    };
  }

  return null;
}

export async function paidSubscriptionFailure(
  memberId: string,
  sportId: string,
  sessionDate: Date,
): Promise<{ subscription: ActiveSubscriptionView } | { failure: AttendancePolicyFailure }> {
  const subscription = await resolveSubscriptionForAttendance(memberId, sportId, sessionDate);

  if (!subscription) {
    return {
      failure: {
        status: 403,
        body: {
          error: "Abonnement inactif - passage exceptionnel requis",
          code: "SUBSCRIPTION_INACTIVE",
        },
      },
    };
  }

  const payCheck = await canCheckInWithPayment(subscription);
  if (!payCheck.allowed) {
    return {
      failure: {
        status: 403,
        body: {
          error: payCheck.reason ?? "Abonnement non paye - passage exceptionnel requis",
          code: "SUBSCRIPTION_UNPAID",
        },
      },
    };
  }

  return { subscription };
}

export function overrideReasonFailure(status: string, reason?: string | null): AttendancePolicyFailure | null {
  if (status !== "OVERRIDE") return null;

  if (!reason || reason.trim().length === 0) {
    return {
      status: 400,
      body: { error: "Motif obligatoire pour un passage exceptionnel" },
    };
  }

  return null;
}
