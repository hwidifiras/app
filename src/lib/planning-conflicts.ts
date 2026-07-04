import { formatUtcDateOnlyIso } from "@/lib/dates";
import { formatRoomLabel } from "@/lib/group-room";

export type PlanningConflictSession = {
  id: string;
  sessionDate: string | Date;
  startTime: string;
  endTime: string;
  coachId: string | null;
  coachName: string | null;
  room: string;
  groupName: string;
  groupSportId?: string | null;
  status: "PLANNED" | "RESCHEDULED" | "CANCELLED" | "COMPLETED";
};

export type PlanningConflictCoach = {
  id: string;
  qualifiedSportIds: string[];
};

export type PlanningConflictPreferences = {
  allowSameRoomConcurrentGroups: boolean;
  allowCoachConcurrentSameRoomQualified: boolean;
};

function minutesFromTime(time: string) {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function sessionsOverlap(a: PlanningConflictSession, b: PlanningConflictSession) {
  return minutesFromTime(a.startTime) < minutesFromTime(b.endTime) &&
    minutesFromTime(b.startTime) < minutesFromTime(a.endTime);
}

function coachIsQualifiedForSport(coach: PlanningConflictCoach | undefined, sportId?: string | null) {
  if (!coach || !sportId) return true;
  return coach.qualifiedSportIds.includes(sportId);
}

function sessionDateKey(session: PlanningConflictSession) {
  return formatUtcDateOnlyIso(new Date(session.sessionDate));
}

export function buildPlanningConflictDetails(params: {
  sessions: PlanningConflictSession[];
  coaches: PlanningConflictCoach[];
  preferences: PlanningConflictPreferences;
}) {
  const details = new Map<string, string[]>();
  const coachesById = new Map(params.coaches.map((coach) => [coach.id, coach]));
  const sessionsByDate = new Map<string, PlanningConflictSession[]>();

  function addDetail(sessionId: string, reason: string) {
    const current = details.get(sessionId) ?? [];
    if (!current.includes(reason)) {
      details.set(sessionId, [...current, reason]);
    }
  }

  for (const session of params.sessions) {
    const key = sessionDateKey(session);
    const current = sessionsByDate.get(key) ?? [];
    current.push(session);
    sessionsByDate.set(key, current);
  }

  for (const daySessions of sessionsByDate.values()) {
    daySessions.sort((a, b) => a.startTime.localeCompare(b.startTime));

    for (let i = 0; i < daySessions.length; i += 1) {
      for (let j = i + 1; j < daySessions.length; j += 1) {
        const a = daySessions[i];
        const b = daySessions[j];
        if (a.status === "CANCELLED" || b.status === "CANCELLED" || !sessionsOverlap(a, b)) {
          continue;
        }

        const sameCoach = a.coachId && b.coachId && a.coachId === b.coachId;
        const sameRoom = formatRoomLabel(a.room) === formatRoomLabel(b.room);
        const coachCanShareSameRoom =
          Boolean(sameCoach) &&
          params.preferences.allowCoachConcurrentSameRoomQualified &&
          sameRoom &&
          coachIsQualifiedForSport(coachesById.get(a.coachId!), a.groupSportId) &&
          coachIsQualifiedForSport(coachesById.get(a.coachId!), b.groupSportId);

        if (sameCoach && !coachCanShareSameRoom) {
          const coachName = a.coachName ?? b.coachName ?? "Coach";
          addDetail(a.id, `${coachName} est déjà affecté à ${b.groupName} (${b.startTime}-${b.endTime}).`);
          addDetail(b.id, `${coachName} est déjà affecté à ${a.groupName} (${a.startTime}-${a.endTime}).`);
        }

        const roomCanShare = params.preferences.allowSameRoomConcurrentGroups || coachCanShareSameRoom;

        if (sameRoom && !roomCanShare) {
          const roomLabel = formatRoomLabel(a.room);
          addDetail(a.id, `${roomLabel} est déjà réservée par ${b.groupName} (${b.startTime}-${b.endTime}).`);
          addDetail(b.id, `${roomLabel} est déjà réservée par ${a.groupName} (${a.startTime}-${a.endTime}).`);
        }
      }
    }
  }

  return details;
}
