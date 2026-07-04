import { prisma } from "@/lib/prisma";
import { utcDateOnlyForTimeZone } from "@/lib/dates";

type AssignmentWindow = {
  status: "ACTIVE";
  startDate: { lte?: Date; lt?: Date };
  OR: Array<{ endDate: null } | { endDate: { gte: Date } }>;
};

export type ScheduleSlot = {
  dayOfWeek: string;
  startTime: string;
  durationMinutes: number;
  effectiveFrom?: Date;
  effectiveTo?: Date | null;
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function intervalsOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
  return start1 < end2 && start2 < end1;
}

export function activeAssignmentWindow(date: Date): AssignmentWindow {
  return {
    status: "ACTIVE",
    startDate: { lte: date },
    OR: [{ endDate: null }, { endDate: { gte: date } }],
  };
}

export function businessDayWindow(date: Date) {
  const dayStart = utcDateOnlyForTimeZone(date);
  const nextDayStart = new Date(dayStart);
  nextDayStart.setUTCDate(nextDayStart.getUTCDate() + 1);
  return { dayStart, nextDayStart };
}

export function activeAssignmentBusinessDayWindow(date: Date): AssignmentWindow {
  const { dayStart, nextDayStart } = businessDayWindow(date);
  return {
    status: "ACTIVE",
    startDate: { lt: nextDayStart },
    OR: [{ endDate: null }, { endDate: { gte: dayStart } }],
  };
}

export function activeAssignmentOverlapWindow(startDate: Date, endDate?: Date | null) {
  const { dayStart } = businessDayWindow(startDate);
  const endWindow = endDate ? businessDayWindow(endDate).nextDayStart : null;

  return {
    status: "ACTIVE" as const,
    ...(endWindow ? { startDate: { lt: endWindow } } : {}),
    OR: [{ endDate: null }, { endDate: { gte: dayStart } }],
  };
}

export function scheduleWindowWhere(startDate: Date, endDate?: Date | null) {
  const { dayStart } = businessDayWindow(startDate);
  const endWindow = endDate ? businessDayWindow(endDate).nextDayStart : null;

  return {
    ...(endWindow ? { effectiveFrom: { lt: endWindow } } : {}),
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: dayStart } }],
  };
}

export function isScheduleActiveOnDate(
  schedule: { effectiveFrom?: Date; effectiveTo?: Date | null },
  date: Date,
) {
  const { dayStart, nextDayStart } = businessDayWindow(date);
  return (
    (!schedule.effectiveFrom || schedule.effectiveFrom < nextDayStart) &&
    (!schedule.effectiveTo || schedule.effectiveTo >= dayStart)
  );
}

export async function schedulesForGroupWindow(groupId: string, startDate: Date, endDate?: Date | null) {
  return prisma.groupSchedule.findMany({
    where: {
      groupId,
      ...scheduleWindowWhere(startDate, endDate),
    },
    select: {
      dayOfWeek: true,
      startTime: true,
      durationMinutes: true,
      effectiveFrom: true,
      effectiveTo: true,
    },
  });
}

export function isDateWithinBusinessDayWindow(
  startDate: Date,
  endDate: Date | null,
  date: Date,
) {
  const { dayStart, nextDayStart } = businessDayWindow(date);
  return startDate < nextDayStart && (!endDate || endDate >= dayStart);
}

export async function findActiveAssignmentOnDate(groupId: string, memberId: string, date: Date) {
  return prisma.groupMember.findFirst({
    where: {
      groupId,
      memberId,
      ...activeAssignmentBusinessDayWindow(date),
    },
    select: { id: true },
  });
}

export async function ensureGroupCapacityOnDate(
  groupId: string,
  date: Date,
  ignoredAssignmentId?: string,
) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { capacity: true },
  });

  if (!group) {
    return { ok: false as const, status: 404, error: "Groupe introuvable" };
  }

  const activeCount = await prisma.groupMember.count({
    where: {
      groupId,
      ...activeAssignmentWindow(date),
      ...(ignoredAssignmentId ? { NOT: { id: ignoredAssignmentId } } : {}),
    },
  });

  if (activeCount >= group.capacity) {
    return { ok: false as const, status: 409, error: "Capacite du groupe atteinte" };
  }

  return { ok: true as const };
}

function schedulesOverlap(a: ScheduleSlot, b: ScheduleSlot) {
  if (a.dayOfWeek !== b.dayOfWeek) return false;

  const aStart = timeToMinutes(a.startTime);
  const bStart = timeToMinutes(b.startTime);
  return intervalsOverlap(aStart, aStart + a.durationMinutes, bStart, bStart + b.durationMinutes);
}

export async function checkScheduleConflictOnDate(
  groupId: string,
  memberId: string,
  date: Date,
  ignoredAssignmentId?: string,
) {
  return checkScheduleConflictForAssignmentWindow(groupId, memberId, date, null, ignoredAssignmentId);
}

export async function checkScheduleConflictForAssignmentWindow(
  groupId: string,
  memberId: string,
  startDate: Date,
  endDate?: Date | null,
  ignoredAssignmentId?: string,
) {
  const newGroupSchedules = await schedulesForGroupWindow(groupId, startDate, endDate);
  if (newGroupSchedules.length === 0) return { ok: true as const };

  const existingAssignments = await prisma.groupMember.findMany({
    where: {
      memberId,
      ...activeAssignmentOverlapWindow(startDate, endDate),
      NOT: ignoredAssignmentId ? { id: ignoredAssignmentId } : { groupId },
    },
    select: { groupId: true, startDate: true, endDate: true, group: { select: { name: true } } },
  });

  for (const assignment of existingAssignments) {
    const overlapStart = assignment.startDate > startDate ? assignment.startDate : startDate;
    const candidateEnd = endDate ?? null;
    const existingEnd = assignment.endDate ?? null;
    const overlapEnd =
      candidateEnd && existingEnd
        ? candidateEnd < existingEnd
          ? candidateEnd
          : existingEnd
        : (candidateEnd ?? existingEnd);

    const existingSchedules = await schedulesForGroupWindow(assignment.groupId, overlapStart, overlapEnd);

    for (const newSchedule of newGroupSchedules) {
      for (const existingSchedule of existingSchedules) {
        if (schedulesOverlap(newSchedule, existingSchedule)) {
          return {
            ok: false as const,
            error: `Conflit d'horaire : ce membre est deja affecte au groupe "${assignment.group.name}" qui se chevauche avec ce groupe.`,
          };
        }
      }
    }
  }

  return { ok: true as const };
}
