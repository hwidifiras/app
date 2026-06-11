import { prisma } from "@/lib/prisma";

/** Max weekly schedule slots among active groups for a sport (the « standard » cadence). */
export async function getSportMaxWeeklySessions(sportId: string): Promise<number | null> {
  const groups = await prisma.group.findMany({
    where: { sportId, isActive: true },
    select: { _count: { select: { schedules: true } } },
  });

  if (groups.length === 0) {
    return null;
  }

  const counts = groups.map((g) => g._count.schedules);
  return Math.max(...counts, 0);
}

export async function getGroupWeeklyScheduleCount(groupId: string): Promise<number> {
  return prisma.groupSchedule.count({ where: { groupId } });
}

export async function validatePlanSessionsPerWeekForSport(
  sportId: string,
  sessionsPerWeek: number,
): Promise<string | null> {
  const sportMax = await getSportMaxWeeklySessions(sportId);

  if (sportMax === null) {
    return null;
  }

  if (sportMax === 0) {
    return "Aucun créneau hebdomadaire configuré sur les groupes de cette discipline — ajoutez des horaires avant de créer une formule.";
  }

  if (sessionsPerWeek > sportMax) {
    return `Cette formule prévoit ${sessionsPerWeek} séance(s)/semaine, mais le standard de la discipline est ${sportMax} séance(s)/semaine maximum.`;
  }

  return null;
}
