import { prisma } from "@/lib/prisma";
import { isScheduleActiveOnDate, scheduleWindowWhere } from "@/lib/assignment-policy";
import { getWeekRangeUtc } from "@/lib/dates";

type DayOfWeekValue = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

const weekdayOffsets: Record<DayOfWeekValue, number> = {
  MONDAY: 0,
  TUESDAY: 1,
  WEDNESDAY: 2,
  THURSDAY: 3,
  FRIDAY: 4,
  SATURDAY: 5,
  SUNDAY: 6,
};

function countSchedulesActiveInWeek(
  schedules: Array<{ dayOfWeek: string; effectiveFrom: Date; effectiveTo: Date | null }>,
  weekStart: Date,
) {
  return schedules.filter((schedule) => {
    const offset = weekdayOffsets[schedule.dayOfWeek as DayOfWeekValue];
    if (offset === undefined) return false;
    const scheduleDate = new Date(weekStart);
    scheduleDate.setUTCDate(scheduleDate.getUTCDate() + offset);
    return isScheduleActiveOnDate(schedule, scheduleDate);
  }).length;
}

/** Max weekly schedule slots among active groups for a sport. */
export async function getSportMaxWeeklySessions(sportId: string, referenceDate: Date = new Date()): Promise<number | null> {
  const { start, end } = getWeekRangeUtc(referenceDate);
  const groups = await prisma.group.findMany({
    where: { sportId, isActive: true },
    select: {
      schedules: {
        where: scheduleWindowWhere(start, end),
        select: { dayOfWeek: true, effectiveFrom: true, effectiveTo: true },
      },
    },
  });

  if (groups.length === 0) {
    return null;
  }

  const counts = groups.map((g) => countSchedulesActiveInWeek(g.schedules, start));
  return Math.max(...counts, 0);
}

export async function getGroupWeeklyScheduleCount(groupId: string, referenceDate: Date = new Date()): Promise<number> {
  const { start, end } = getWeekRangeUtc(referenceDate);
  const schedules = await prisma.groupSchedule.findMany({
    where: { groupId, ...scheduleWindowWhere(start, end) },
    select: { dayOfWeek: true, effectiveFrom: true, effectiveTo: true },
  });
  return countSchedulesActiveInWeek(schedules, start);
}

export async function validatePlanSessionsPerWeekForSport(
  sportId: string,
  sessionsPerWeek: number,
  referenceDate: Date = new Date(),
): Promise<string | null> {
  const sportMax = await getSportMaxWeeklySessions(sportId, referenceDate);

  if (sportMax === null || sportMax === 0) {
    return null;
  }

  if (sessionsPerWeek > sportMax) {
    return `Cette formule prevoit ${sessionsPerWeek} seance(s)/semaine, mais le standard de la discipline est ${sportMax} seance(s)/semaine maximum.`;
  }

  return null;
}
