import type { AttendanceStatus, MemberType } from "@prisma/client";

import { getClubSettings } from "@/lib/club-settings";
import { getWeekRangeUtc } from "@/lib/dates";
import { resolveMemberPhone } from "@/lib/member-phone";
import { prisma } from "@/lib/prisma";
import type { DataImportPayload } from "@/lib/schemas/data-import";
import { getGroupWeeklyScheduleCount } from "@/lib/sport-weekly-standard";
import { getRequiredTenantId } from "@/lib/tenant-context";
import {
  getWeeklyConsumptionMode,
  loadGroupWeekSessions,
  simulateWeeklyAllowanceRemaining,
} from "@/lib/weekly-session-consumption";

export type DataImportInspection = {
  memberPhone: string;
  memberName: string;
  groupName: string;
  planName: string;
  sportName: string;
  remainingBalanceCents: number;
  attendanceCount: number;
  warnings: string[];
};

type ImportContext = {
  inspection: DataImportInspection;
  memberPhone: string;
  group: {
    id: string;
    name: string;
    groupType: "KIDS" | "ADULTS";
    sportId: string;
    capacity: number;
    activeMembers: number;
  };
  plan: {
    id: string;
    name: string;
    sportId: string;
    totalSessions: number;
    sessionsPerWeek: number | null;
  };
  sessions: Array<{ id: string; sessionDate: Date; status: string }>;
};

export async function inspectDataImport(payload: DataImportPayload): Promise<ImportContext> {
  const tenantId = getRequiredTenantId();
  const cutoverDate = new Date(payload.cutoverDate);
  const { start: weekStart, end: weekEnd } = getWeekRangeUtc(cutoverDate);
  const memberPhone = resolveMemberPhone({
    memberType: payload.member.memberType,
    phone: payload.member.phone,
    parentPhone: payload.member.parentPhone,
    firstName: payload.member.firstName,
    lastName: payload.member.lastName,
  });

  const [duplicateMember, group, plan, sessions, settings] = await Promise.all([
    prisma.member.findUnique({ where: { tenantId_phone: { tenantId, phone: memberPhone } }, select: { id: true } }),
    prisma.group.findUnique({
      where: { id: payload.groupId },
      select: {
        id: true,
        name: true,
        groupType: true,
        sportId: true,
        capacity: true,
        isActive: true,
        _count: { select: { members: { where: { status: "ACTIVE" } } } },
        sport: { select: { name: true } },
      },
    }),
    prisma.subscriptionPlan.findUnique({
      where: { id: payload.planId },
      select: {
        id: true,
        name: true,
        sportId: true,
        totalSessions: true,
        sessionsPerWeek: true,
        isActive: true,
      },
    }),
    prisma.session.findMany({
      where: { id: { in: payload.attendances.map((row) => row.sessionId) } },
      select: { id: true, groupId: true, sessionDate: true, status: true },
    }),
    getClubSettings(),
  ]);

  if (duplicateMember) throw new Error("MEMBER_PHONE_EXISTS");
  if (!group) throw new Error("GROUP_NOT_FOUND");
  if (!group.isActive) throw new Error("GROUP_INACTIVE");
  if (!plan) throw new Error("PLAN_NOT_FOUND");
  if (!plan.isActive) throw new Error("PLAN_INACTIVE");
  if (group.sportId !== plan.sportId) throw new Error("PLAN_GROUP_MISMATCH");
  if (group._count.members >= group.capacity) throw new Error("GROUP_CAPACITY_REACHED");
  if (payload.remainingSessions > plan.totalSessions) throw new Error("REMAINING_ABOVE_PLAN");
  if (group.groupType === "KIDS" && payload.member.memberType === "ADULT") {
    throw new Error("MEMBER_GROUP_MISMATCH");
  }
  if (group.groupType === "ADULTS" && payload.member.memberType === "KID") {
    throw new Error("MEMBER_GROUP_MISMATCH");
  }
  if (sessions.length !== payload.attendances.length) throw new Error("SESSION_NOT_FOUND");

  for (const session of sessions) {
    if (
      session.groupId !== group.id ||
      session.status === "CANCELLED" ||
      session.sessionDate < weekStart ||
      session.sessionDate >= weekEnd ||
      session.sessionDate > cutoverDate
    ) {
      throw new Error("SESSION_NOT_ELIGIBLE");
    }
  }

  if (plan.sessionsPerWeek && payload.attendances.length > 0) {
    const groupWeeklySessions = await getGroupWeeklyScheduleCount(group.id);
    const sessionsInWeek = await loadGroupWeekSessions(group.id, cutoverDate);
    const statuses = new Map<string, AttendanceStatus>(
      payload.attendances.map((row) => [row.sessionId, row.status]),
    );
    const weeklyRemaining = simulateWeeklyAllowanceRemaining({
      planAllowance: plan.sessionsPerWeek,
      mode: getWeeklyConsumptionMode(plan.sessionsPerWeek, groupWeeklySessions),
      sessionsInWeek,
      attendancesBySessionId: statuses,
      absentConsumesSession: settings.absentConsumesSession,
    });
    if (weeklyRemaining < 0) throw new Error("WEEKLY_LIMIT_EXCEEDED");
  }

  const warnings: string[] = [];
  if (payload.paidCents === 0) {
    warnings.push("Aucun règlement historique ne sera créé.");
  }
  if (payload.attendances.length === 0 && cutoverDate.getUTCDay() !== 1) {
    warnings.push("Aucune présence antérieure n'est renseignée pour la semaine de bascule.");
  }

  return {
    memberPhone,
    group: {
      id: group.id,
      name: group.name,
      groupType: group.groupType,
      sportId: group.sportId,
      capacity: group.capacity,
      activeMembers: group._count.members,
    },
    plan: {
      id: plan.id,
      name: plan.name,
      sportId: plan.sportId,
      totalSessions: plan.totalSessions,
      sessionsPerWeek: plan.sessionsPerWeek,
    },
    sessions,
    inspection: {
      memberPhone,
      memberName: `${payload.member.firstName} ${payload.member.lastName}`,
      groupName: group.name,
      planName: plan.name,
      sportName: group.sport.name,
      remainingBalanceCents: payload.amountCents - payload.paidCents,
      attendanceCount: payload.attendances.length,
      warnings,
    },
  };
}

export async function applyDataImport(
  payload: DataImportPayload,
  actorId: string,
): Promise<{ auditLogId: string; memberId: string }> {
  const tenantId = getRequiredTenantId();
  const context = await inspectDataImport(payload);

  return prisma.$transaction(async (tx) => {
    const groupState = await tx.group.findUniqueOrThrow({
      where: { id: context.group.id },
      select: {
        capacity: true,
        _count: { select: { members: { where: { status: "ACTIVE" } } } },
      },
    });
    if (groupState._count.members >= groupState.capacity) {
      throw new Error("GROUP_CAPACITY_REACHED");
    }

    const member = await tx.member.create({
      data: {
        tenantId,
        firstName: payload.member.firstName,
        lastName: payload.member.lastName,
        phone: context.memberPhone,
        email: payload.member.email || null,
        memberType: payload.member.memberType as MemberType,
        birthDate: payload.member.birthDate ? new Date(payload.member.birthDate) : null,
        address: payload.member.address || null,
        parentName: payload.member.parentName || null,
        parentPhone: payload.member.parentPhone || null,
        joinedAt: new Date(payload.member.joinedAt),
      },
    });

    const subscription = await tx.memberSubscription.create({
      data: {
        tenantId,
        memberId: member.id,
        planId: context.plan.id,
        sportId: context.plan.sportId,
        startDate: new Date(payload.subscriptionStartDate),
        endDate: new Date(payload.subscriptionEndDate),
        amount: payload.amountCents,
        remainingSessions: payload.remainingSessions,
        status: "ACTIVE",
      },
    });
    const assignment = await tx.groupMember.create({
      data: {
        tenantId,
        memberId: member.id,
        groupId: context.group.id,
        startDate: new Date(payload.assignmentStartDate),
        status: "ACTIVE",
      },
    });
    const payment =
      payload.paidCents > 0
        ? await tx.payment.create({
            data: {
              tenantId,
              memberSubscriptionId: subscription.id,
              amount: payload.paidCents,
              createdById: actorId,
              paymentDate: payload.paymentDate ? new Date(payload.paymentDate) : new Date(payload.cutoverDate),
              paymentMethod: payload.paymentMethod || "REPRISE_PAPIER",
              notes: payload.note,
            },
          })
        : null;

    const attendanceIds: string[] = [];
    for (const attendance of payload.attendances) {
      const created = await tx.attendance.create({
        data: {
          tenantId,
          sessionId: attendance.sessionId,
          memberId: member.id,
          memberSubscriptionId: subscription.id,
          status: attendance.status,
          checkedBy: actorId,
          checkedAt: new Date(payload.cutoverDate),
          overrideReason: "Historique repris depuis le registre papier",
        },
      });
      attendanceIds.push(created.id);
    }

    const audit = await tx.auditLog.create({
      data: {
        tenantId,
        action: "DATA_IMPORT_APPLIED",
        entityType: "DataImport",
        entityId: member.id,
        userId: actorId,
        details: JSON.stringify({
          source: "manual-paper-migration",
          note: payload.note,
          memberId: member.id,
          subscriptionId: subscription.id,
          assignmentId: assignment.id,
          paymentId: payment?.id ?? null,
          attendanceIds,
        }),
      },
    });

    return { auditLogId: audit.id, memberId: member.id };
  });
}

type ImportAuditDetails = {
  memberId: string;
  subscriptionId: string;
  assignmentId: string;
  paymentId: string | null;
  attendanceIds: string[];
};

export async function rollbackDataImport(auditLogId: string, actorId: string) {
  const tenantId = getRequiredTenantId();
  const audit = await prisma.auditLog.findUnique({ where: { id: auditLogId } });
  if (!audit || audit.action !== "DATA_IMPORT_APPLIED" || !audit.details) {
    throw new Error("IMPORT_NOT_FOUND");
  }

  const details = JSON.parse(audit.details) as ImportAuditDetails;
  const [member, subscription] = await Promise.all([
    prisma.member.findUnique({
      where: { id: details.memberId },
      select: {
        id: true,
        groups: { select: { id: true } },
        subscriptions: { select: { id: true } },
        attendances: { select: { id: true } },
        householdLink: { select: { id: true } },
      },
    }),
    prisma.memberSubscription.findUnique({
      where: { id: details.subscriptionId },
      select: {
        payments: { select: { id: true } },
        attendances: { select: { id: true } },
      },
    }),
  ]);

  if (!member || !subscription) throw new Error("IMPORT_ALREADY_REMOVED");
  const expectedAttendanceIds = new Set(details.attendanceIds);
  const hasExternalData =
    member.groups.some((row) => row.id !== details.assignmentId) ||
    member.subscriptions.some((row) => row.id !== details.subscriptionId) ||
    member.attendances.some((row) => !expectedAttendanceIds.has(row.id)) ||
    subscription.attendances.some((row) => !expectedAttendanceIds.has(row.id)) ||
    subscription.payments.some((row) => row.id !== details.paymentId) ||
    Boolean(member.householdLink);
  if (hasExternalData) throw new Error("IMPORT_HAS_NEW_ACTIVITY");

  await prisma.$transaction(async (tx) => {
    await tx.attendance.deleteMany({ where: { id: { in: details.attendanceIds } } });
    if (details.paymentId) await tx.payment.deleteMany({ where: { id: details.paymentId } });
    await tx.groupMember.deleteMany({ where: { id: details.assignmentId } });
    await tx.memberSubscription.deleteMany({ where: { id: details.subscriptionId } });
    await tx.member.delete({ where: { id: details.memberId } });
    await tx.auditLog.create({
      data: {
        tenantId,
        action: "DATA_IMPORT_ROLLED_BACK",
        entityType: "DataImport",
        entityId: details.memberId,
        userId: actorId,
        details: JSON.stringify({ sourceAuditLogId: auditLogId }),
      },
    });
  });
}

export function dataImportErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  const messages: Record<string, string> = {
    MEMBER_PHONE_EXISTS: "Un membre utilise déjà ce téléphone.",
    PHONE_REQUIRED: "Téléphone du membre requis.",
    PARENT_PHONE_REQUIRED: "Téléphone du parent requis.",
    GROUP_NOT_FOUND: "Groupe introuvable.",
    GROUP_INACTIVE: "Le groupe sélectionné est inactif.",
    PLAN_NOT_FOUND: "Formule introuvable.",
    PLAN_INACTIVE: "La formule sélectionnée est inactive.",
    PLAN_GROUP_MISMATCH: "La formule et le groupe n'appartiennent pas à la même discipline.",
    GROUP_CAPACITY_REACHED: "La capacité du groupe est atteinte.",
    REMAINING_ABOVE_PLAN: "Les séances restantes dépassent le quota de la formule.",
    MEMBER_GROUP_MISMATCH: "Le type de membre n'est pas compatible avec ce groupe.",
    SESSION_NOT_FOUND: "Une séance sélectionnée est introuvable.",
    SESSION_NOT_ELIGIBLE: "Une séance sélectionnée n'est pas éligible à la reprise.",
    WEEKLY_LIMIT_EXCEEDED: "Les présences reprises dépassent le quota hebdomadaire.",
    IMPORT_NOT_FOUND: "Reprise introuvable.",
    IMPORT_ALREADY_REMOVED: "Cette reprise a déjà été supprimée.",
    IMPORT_HAS_NEW_ACTIVITY: "Annulation refusée: de nouvelles données sont liées à ce membre.",
  };
  return messages[code] ?? "La reprise n'a pas pu être validée.";
}
