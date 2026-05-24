import { prisma } from "@/lib/prisma";
import { getAppTimeZone } from "@/lib/dates";

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map((value) => Number(value));
  return hours * 60 + minutes;
}

function intervalsOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
  return start1 < end2 && start2 < end1;
}

function timesOverlap(startTimeA: string, endTimeA: string, startTimeB: string, endTimeB: string): boolean {
  return intervalsOverlap(
    timeToMinutes(startTimeA),
    timeToMinutes(endTimeA),
    timeToMinutes(startTimeB),
    timeToMinutes(endTimeB),
  );
}

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

type SessionConflictCandidate = {
  id: string;
  startTime: string;
  endTime: string;
  group: { name: string };
  coach: { firstName: string; lastName: string } | null;
  room: string;
};

async function findOverlappingSessions(params: {
  sessionDate: Date;
  startTime: string;
  endTime: string;
  excludeIds: string[];
  coachId?: string;
  room?: string;
}): Promise<SessionConflictCandidate | null> {
  const where: {
    sessionDate: Date;
    id?: { not: string } | { notIn: string[] };
    coachId?: string;
    room?: string;
    status?: { not: "CANCELLED" };
  } = {
    sessionDate: params.sessionDate,
    status: { not: "CANCELLED" },
    ...(params.excludeIds.length === 1
      ? { id: { not: params.excludeIds[0] } }
      : params.excludeIds.length > 0
        ? { id: { notIn: params.excludeIds } }
        : {}),
  };

  if (params.coachId) {
    where.coachId = params.coachId;
  }

  if (params.room) {
    where.room = params.room;
  }

  const sessions = await prisma.session.findMany({
    where,
    select: {
      id: true,
      startTime: true,
      endTime: true,
      room: true,
      group: { select: { name: true } },
      coach: { select: { firstName: true, lastName: true } },
    },
  });

  return (
    sessions.find((session) =>
      timesOverlap(params.startTime, params.endTime, session.startTime, session.endTime),
    ) ?? null
  );
}

export function buildCoachConflictMessage(
  coachName: string,
  sessionDate: Date,
  startTime: string,
  conflictingGroupName: string,
) {
  return `Le coach ${coachName} est déjà assigné au cours « ${conflictingGroupName} » le ${formatSessionSlotLabel(sessionDate, startTime)}.`;
}

export function buildRoomConflictMessage(
  room: string,
  sessionDate: Date,
  startTime: string,
  conflictingGroupName: string,
) {
  return `La salle « ${room} » est déjà réservée par « ${conflictingGroupName} » le ${formatSessionSlotLabel(sessionDate, startTime)}.`;
}

export async function findCoachSessionConflict(params: {
  coachId: string | null | undefined;
  sessionDate: Date;
  startTime: string;
  endTime: string;
  excludeIds: string[];
}) {
  if (!params.coachId) return null;

  return findOverlappingSessions({
    sessionDate: params.sessionDate,
    startTime: params.startTime,
    endTime: params.endTime,
    excludeIds: params.excludeIds,
    coachId: params.coachId,
  });
}

export async function findRoomSessionConflict(params: {
  room: string | null | undefined;
  sessionDate: Date;
  startTime: string;
  endTime: string;
  excludeIds: string[];
}) {
  const room = params.room?.trim();
  if (!room) return null;

  return findOverlappingSessions({
    sessionDate: params.sessionDate,
    startTime: params.startTime,
    endTime: params.endTime,
    excludeIds: params.excludeIds,
    room,
  });
}

export async function validateSessionSlot(params: {
  groupId: string;
  groupName: string;
  sessionDate: Date;
  startTime: string;
  endTime: string;
  coachId: string | null | undefined;
  room: string | null | undefined;
  excludeIds: string[];
}): Promise<string | null> {
  const groupConflict = await findSessionSlotConflict({
    groupId: params.groupId,
    sessionDate: params.sessionDate,
    startTime: params.startTime,
    excludeIds: params.excludeIds,
  });

  if (groupConflict) {
    return buildSessionSlotConflictMessage(params.groupName, params.sessionDate, params.startTime);
  }

  const coachConflict = await findCoachSessionConflict({
    coachId: params.coachId,
    sessionDate: params.sessionDate,
    startTime: params.startTime,
    endTime: params.endTime,
    excludeIds: params.excludeIds,
  });

  if (coachConflict?.coach) {
    return buildCoachConflictMessage(
      `${coachConflict.coach.firstName} ${coachConflict.coach.lastName}`,
      params.sessionDate,
      coachConflict.startTime,
      coachConflict.group.name,
    );
  }

  const roomConflict = await findRoomSessionConflict({
    room: params.room,
    sessionDate: params.sessionDate,
    startTime: params.startTime,
    endTime: params.endTime,
    excludeIds: params.excludeIds,
  });

  if (roomConflict) {
    return buildRoomConflictMessage(
      roomConflict.room,
      params.sessionDate,
      roomConflict.startTime,
      roomConflict.group.name,
    );
  }

  return null;
}
