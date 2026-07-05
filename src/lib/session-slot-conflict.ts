import { prisma } from "@/lib/prisma";
import { getAppTimeZone } from "@/lib/dates";
import { getClubSettings } from "@/lib/club-settings";
import { getRequiredTenantId } from "@/lib/tenant-context";

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
  const tenantId = getRequiredTenantId();
  return prisma.session.findFirst({
    where: {
      tenantId,
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
  coachId: string | null;
  group: { name: string; sportId: string };
  coach: { firstName: string; lastName: string } | null;
  room: string;
};

function sameRoom(roomA: string | null | undefined, roomB: string | null | undefined) {
  return (roomA ?? "").trim().toLowerCase() === (roomB ?? "").trim().toLowerCase();
}

async function coachIsQualifiedForAllSports(coachId: string, sportIds: string[]) {
  const tenantId = getRequiredTenantId();
  const coach = await prisma.coach.findFirst({
    where: { id: coachId, tenantId },
    select: {
      sportId: true,
      qualifications: { select: { sportId: true } },
    },
  });

  if (!coach) return false;

  const qualifiedSportIds = new Set([
    coach.sportId,
    ...coach.qualifications.map((qualification) => qualification.sportId),
  ]);

  return sportIds.every((sportId) => qualifiedSportIds.has(sportId));
}

async function findOverlappingSessions(params: {
  sessionDate: Date;
  startTime: string;
  endTime: string;
  excludeIds: string[];
  coachId?: string;
  room?: string;
}): Promise<SessionConflictCandidate[]> {
  const where: {
    tenantId: string;
    sessionDate: Date;
    id?: { not: string } | { notIn: string[] };
    coachId?: string;
    room?: string;
    status?: { not: "CANCELLED" };
  } = {
    tenantId: getRequiredTenantId(),
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
      coachId: true,
      room: true,
      group: { select: { name: true, sportId: true } },
      coach: { select: { firstName: true, lastName: true } },
    },
  });

  return sessions.filter((session) =>
    timesOverlap(params.startTime, params.endTime, session.startTime, session.endTime),
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
  room?: string | null;
  groupSportId?: string | null;
  allowConcurrentSameRoomQualified?: boolean;
}) {
  if (!params.coachId) return null;

  const conflicts = await findOverlappingSessions({
    sessionDate: params.sessionDate,
    startTime: params.startTime,
    endTime: params.endTime,
    excludeIds: params.excludeIds,
    coachId: params.coachId,
  });

  for (const conflict of conflicts) {
    const canShareCoach =
      params.allowConcurrentSameRoomQualified &&
      params.groupSportId &&
      sameRoom(params.room, conflict.room) &&
      await coachIsQualifiedForAllSports(params.coachId, [params.groupSportId, conflict.group.sportId]);

    if (!canShareCoach) {
      return conflict;
    }
  }

  return null;
}

export async function findRoomSessionConflict(params: {
  room: string | null | undefined;
  sessionDate: Date;
  startTime: string;
  endTime: string;
  excludeIds: string[];
  allowConcurrentGroups?: boolean;
  coachId?: string | null;
  groupSportId?: string | null;
  allowCoachConcurrentSameRoomQualified?: boolean;
}) {
  const room = params.room?.trim();
  if (!room) return null;
  if (params.allowConcurrentGroups) return null;

  const conflicts = await findOverlappingSessions({
    sessionDate: params.sessionDate,
    startTime: params.startTime,
    endTime: params.endTime,
    excludeIds: params.excludeIds,
    room,
  });

  for (const conflict of conflicts) {
    const canShareRoomViaCoach =
      params.allowCoachConcurrentSameRoomQualified &&
      params.coachId &&
      params.groupSportId &&
      conflict.coachId === params.coachId &&
      await coachIsQualifiedForAllSports(params.coachId, [params.groupSportId, conflict.group.sportId]);

    if (!canShareRoomViaCoach) {
      return conflict;
    }
  }

  return null;
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
  groupSportId?: string | null;
}): Promise<string | null> {
  const settings = await getClubSettings();
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
    room: params.room,
    groupSportId: params.groupSportId,
    allowConcurrentSameRoomQualified: settings.allowCoachConcurrentSameRoomQualified,
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
    allowConcurrentGroups: settings.allowSameRoomConcurrentGroups,
    coachId: params.coachId,
    groupSportId: params.groupSportId,
    allowCoachConcurrentSameRoomQualified: settings.allowCoachConcurrentSameRoomQualified,
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
