import { prisma } from "@/lib/prisma";
import { utcDateOnlyForTimeZone } from "@/lib/dates";

type AssignmentWindow = {
  status: "ACTIVE";
  startDate: { lte?: Date; lt?: Date };
  OR: Array<{ endDate: null } | { endDate: { gte: Date } }>;
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

export async function checkScheduleConflictOnDate(
  groupId: string,
  memberId: string,
  date: Date,
  ignoredAssignmentId?: string,
) {
  const newGroupSchedules = await prisma.groupSchedule.findMany({
    where: { groupId },
    select: { dayOfWeek: true, startTime: true, durationMinutes: true },
  });

  if (newGroupSchedules.length === 0) return { ok: true as const };

  const existingAssignments = await prisma.groupMember.findMany({
    where: {
      memberId,
      ...activeAssignmentWindow(date),
      NOT: ignoredAssignmentId ? { id: ignoredAssignmentId } : { groupId },
    },
    select: { groupId: true, group: { select: { name: true } } },
  });

  for (const assignment of existingAssignments) {
    const existingSchedules = await prisma.groupSchedule.findMany({
      where: { groupId: assignment.groupId },
      select: { dayOfWeek: true, startTime: true, durationMinutes: true },
    });

    for (const newSchedule of newGroupSchedules) {
      for (const existingSchedule of existingSchedules) {
        if (newSchedule.dayOfWeek !== existingSchedule.dayOfWeek) continue;

        const newStart = timeToMinutes(newSchedule.startTime);
        const newEnd = newStart + newSchedule.durationMinutes;
        const existingStart = timeToMinutes(existingSchedule.startTime);
        const existingEnd = existingStart + existingSchedule.durationMinutes;

        if (intervalsOverlap(newStart, newEnd, existingStart, existingEnd)) {
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
