import { prisma } from "@/lib/prisma";
import { getWeekRangeUtc } from "@/lib/dates";

export const RECOVERY_OVERRIDE_PREFIX = "Récupération";

export const WEEKLY_SLOT_STATUSES = ["PRESENT", "ABSENT"] as const;

export async function countWeeklySlotUsage(
  memberSubscriptionId: string,
  sessionDate: Date,
): Promise<number> {
  const { start, end } = getWeekRangeUtc(sessionDate);

  return prisma.attendance.count({
    where: {
      memberSubscriptionId,
      status: { in: [...WEEKLY_SLOT_STATUSES] },
      session: {
        sessionDate: { gte: start, lt: end },
      },
    },
  });
}

export function isRecoveryOverrideReason(reason: string | null | undefined): boolean {
  return (reason?.trim() ?? "").startsWith(RECOVERY_OVERRIDE_PREFIX);
}

export async function findRecoveryEligibleAbsences(params: {
  memberId: string;
  targetSessionId: string;
  targetGroupId: string;
  targetSportId: string;
  targetGroupType: "KIDS" | "ADULTS";
  targetSessionDate: Date;
}) {
  const { start, end } = getWeekRangeUtc(params.targetSessionDate);

  const absences = await prisma.attendance.findMany({
    where: {
      memberId: params.memberId,
      status: "ABSENT",
      session: {
        id: { not: params.targetSessionId },
        groupId: { not: params.targetGroupId },
        sessionDate: { gte: start, lt: end },
        group: {
          sportId: params.targetSportId,
          groupType: params.targetGroupType,
        },
      },
    },
    select: {
      id: true,
      session: {
        select: {
          id: true,
          sessionDate: true,
          group: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { checkedAt: "desc" },
  });

  if (absences.length === 0) return [];

  const recoveriesThisWeek = await prisma.attendance.findMany({
    where: {
      memberId: params.memberId,
      status: "OVERRIDE",
      session: {
        sessionDate: { gte: start, lt: end },
      },
      overrideReason: { startsWith: RECOVERY_OVERRIDE_PREFIX },
    },
    select: { id: true },
  });

  if (recoveriesThisWeek.length >= absences.length) {
    return [];
  }

  return absences;
}

export async function validateRecoveryCheckIn(params: {
  memberId: string;
  targetSessionId: string;
  targetGroupId: string;
  targetSportId: string;
  targetGroupType: "KIDS" | "ADULTS";
  targetSessionDate: Date;
}): Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  const eligible = await findRecoveryEligibleAbsences(params);

  if (eligible.length === 0) {
    return {
      ok: false,
      error:
        "Aucune absence récupérable cette semaine sur un cours équivalent — vérifiez qu'un absent a été pointé sur le même sport et le même type de cours.",
      code: "RECOVERY_NOT_ELIGIBLE",
    };
  }

  return { ok: true };
}

export async function listRecoveryCandidatesForSession(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      sessionDate: true,
      groupId: true,
      group: { select: { sportId: true, groupType: true, name: true } },
    },
  });

  if (!session) return [];

  const { start, end } = getWeekRangeUtc(session.sessionDate);

  const absences = await prisma.attendance.findMany({
    where: {
      status: "ABSENT",
      session: {
        id: { not: session.id },
        groupId: { not: session.groupId },
        sessionDate: { gte: start, lt: end },
        group: {
          sportId: session.group.sportId,
          groupType: session.group.groupType,
        },
      },
      member: { status: "ACTIVE" },
    },
    select: {
      memberId: true,
      member: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
      session: {
        select: {
          sessionDate: true,
          group: { select: { name: true } },
        },
      },
    },
  });

  const recoveries = await prisma.attendance.findMany({
    where: {
      status: "OVERRIDE",
      overrideReason: { startsWith: RECOVERY_OVERRIDE_PREFIX },
      session: { sessionDate: { gte: start, lt: end } },
    },
    select: { memberId: true },
  });

  const recoveredMemberIds = new Set(recoveries.map((row) => row.memberId));
  const seen = new Set<string>();
  const candidates: Array<{
    memberId: string;
    firstName: string;
    lastName: string;
    phone: string;
    absentGroupName: string;
    absentDate: Date;
  }> = [];

  for (const row of absences) {
    if (recoveredMemberIds.has(row.memberId) || seen.has(row.memberId)) continue;
    seen.add(row.memberId);
    candidates.push({
      memberId: row.memberId,
      firstName: row.member.firstName,
      lastName: row.member.lastName,
      phone: row.member.phone,
      absentGroupName: row.session.group.name,
      absentDate: row.session.sessionDate,
    });
  }

  return candidates.sort((a, b) =>
    `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "fr"),
  );
}
