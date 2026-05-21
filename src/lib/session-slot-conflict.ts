import { prisma } from "@/lib/prisma";
import { getAppTimeZone } from "@/lib/dates";

export function formatSessionSlotLabel(sessionDate: Date, startTime: string, timeZone = getAppTimeZone()) {
  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(sessionDate);

  return `${dateLabel} à ${startTime}`;
}

export async function findSessionSlotConflict(params: {
  groupId: string;
  sessionDate: Date;
  startTime: string;
  excludeIds: string[];
}) {
  return prisma.session.findFirst({
    where: {
      groupId: params.groupId,
      sessionDate: params.sessionDate,
      startTime: params.startTime,
      ...(params.excludeIds.length === 1
        ? { id: { not: params.excludeIds[0] } }
        : { id: { notIn: params.excludeIds } }),
    },
    select: {
      id: true,
      sessionDate: true,
      startTime: true,
      status: true,
    },
  });
}

export function buildSessionSlotConflictMessage(groupName: string, sessionDate: Date, startTime: string) {
  return `Une séance du groupe « ${groupName} » existe déjà le ${formatSessionSlotLabel(sessionDate, startTime)}. Choisissez une autre date ou heure.`;
}
