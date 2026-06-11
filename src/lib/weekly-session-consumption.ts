import type { AttendanceStatus } from "@prisma/client";

import { getWeekRangeUtc } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getGroupWeeklyScheduleCount } from "@/lib/sport-weekly-standard";

export type WeeklyConsumptionMode = "CONTEXTUAL" | "STANDARD";

export type WeekSessionSlot = {
  id: string;
  sessionDate: Date;
  startTime: string;
};

export function getWeeklyConsumptionMode(
  planSessionsPerWeek: number | null | undefined,
  groupWeeklySessions: number,
): WeeklyConsumptionMode {
  if (!planSessionsPerWeek || planSessionsPerWeek >= groupWeeklySessions) {
    return "STANDARD";
  }
  return "CONTEXTUAL";
}

/** How many monthly/weekly units one check-in consumes (0 or 1). */
export function resolveSessionConsumptionUnits(params: {
  status: AttendanceStatus;
  mode: WeeklyConsumptionMode;
  weeklyAllowanceRemaining: number;
  remainingGroupSlotsIncludingCurrent: number;
  absentConsumesSession: boolean;
}): number {
  const {
    status,
    mode,
    weeklyAllowanceRemaining,
    remainingGroupSlotsIncludingCurrent,
    absentConsumesSession,
  } = params;

  if (status === "OVERRIDE") {
    return 0;
  }

  if (mode === "STANDARD") {
    if (status === "PRESENT") return 1;
    if (status === "ABSENT") return absentConsumesSession ? 1 : 0;
    return 0;
  }

  if (status === "PRESENT") {
    return 1;
  }

  if (status === "ABSENT") {
    return weeklyAllowanceRemaining >= remainingGroupSlotsIncludingCurrent ? 1 : 0;
  }

  return 0;
}

function compareSessionSlots(a: WeekSessionSlot, b: WeekSessionSlot): number {
  const dateDiff = a.sessionDate.getTime() - b.sessionDate.getTime();
  if (dateDiff !== 0) return dateDiff;
  return a.startTime.localeCompare(b.startTime);
}

export function simulateWeeklyAllowanceRemaining(params: {
  planAllowance: number;
  mode: WeeklyConsumptionMode;
  sessionsInWeek: WeekSessionSlot[];
  attendancesBySessionId: Map<string, AttendanceStatus>;
  absentConsumesSession: boolean;
  beforeSessionId?: string;
}): number {
  const {
    planAllowance,
    mode,
    sessionsInWeek,
    attendancesBySessionId,
    absentConsumesSession,
    beforeSessionId,
  } = params;

  let weeklyRemaining = planAllowance;
  const totalInWeek = sessionsInWeek.length;

  for (let index = 0; index < sessionsInWeek.length; index++) {
    const session = sessionsInWeek[index];

    if (beforeSessionId && session.id === beforeSessionId) {
      break;
    }

    const status = attendancesBySessionId.get(session.id);
    if (!status) {
      continue;
    }

    const remainingGroupSlots = totalInWeek - index;
    const units = resolveSessionConsumptionUnits({
      status,
      mode,
      weeklyAllowanceRemaining: weeklyRemaining,
      remainingGroupSlotsIncludingCurrent: remainingGroupSlots,
      absentConsumesSession,
    });
    weeklyRemaining -= units;
  }

  return weeklyRemaining;
}

export function consumptionUnitsForSessionSlot(params: {
  status: AttendanceStatus;
  mode: WeeklyConsumptionMode;
  planAllowance: number;
  sessionsInWeek: WeekSessionSlot[];
  attendancesBySessionId: Map<string, AttendanceStatus>;
  absentConsumesSession: boolean;
  sessionId: string;
}): number {
  const sessionIndex = params.sessionsInWeek.findIndex((s) => s.id === params.sessionId);
  if (sessionIndex < 0) {
    return resolveSessionConsumptionUnits({
      status: params.status,
      mode: params.mode,
      weeklyAllowanceRemaining: params.planAllowance,
      remainingGroupSlotsIncludingCurrent: 1,
      absentConsumesSession: params.absentConsumesSession,
    });
  }

  const weeklyAllowanceRemaining = simulateWeeklyAllowanceRemaining({
    planAllowance: params.planAllowance,
    mode: params.mode,
    sessionsInWeek: params.sessionsInWeek,
    attendancesBySessionId: params.attendancesBySessionId,
    absentConsumesSession: params.absentConsumesSession,
    beforeSessionId: params.sessionId,
  });

  const remainingGroupSlotsIncludingCurrent = params.sessionsInWeek.length - sessionIndex;

  return resolveSessionConsumptionUnits({
    status: params.status,
    mode: params.mode,
    weeklyAllowanceRemaining,
    remainingGroupSlotsIncludingCurrent,
    absentConsumesSession: params.absentConsumesSession,
  });
}

export async function loadGroupWeekSessions(
  groupId: string,
  sessionDate: Date,
): Promise<WeekSessionSlot[]> {
  const { start, end } = getWeekRangeUtc(sessionDate);

  const sessions = await prisma.session.findMany({
    where: {
      groupId,
      sessionDate: { gte: start, lt: end },
      status: { not: "CANCELLED" },
    },
    select: { id: true, sessionDate: true, startTime: true },
    orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
  });

  return sessions.sort(compareSessionSlots);
}

export async function loadWeekAttendanceStatuses(params: {
  memberId: string;
  memberSubscriptionId: string;
  groupId: string;
  sessionDate: Date;
  omitSessionId?: string;
}): Promise<Map<string, AttendanceStatus>> {
  const { start, end } = getWeekRangeUtc(params.sessionDate);

  const rows = await prisma.attendance.findMany({
    where: {
      memberId: params.memberId,
      memberSubscriptionId: params.memberSubscriptionId,
      session: {
        groupId: params.groupId,
        sessionDate: { gte: start, lt: end },
      },
    },
    select: { sessionId: true, status: true },
  });

  const map = new Map<string, AttendanceStatus>();
  for (const row of rows) {
    if (params.omitSessionId && row.sessionId === params.omitSessionId) {
      continue;
    }
    map.set(row.sessionId, row.status);
  }
  return map;
}

export async function resolveCheckInConsumption(params: {
  status: AttendanceStatus;
  sessionId: string;
  groupId: string;
  sessionDate: Date;
  memberId: string;
  memberSubscriptionId: string;
  planSessionsPerWeek: number | null;
  absentConsumesSession: boolean;
}): Promise<{
  units: number;
  weeklyAllowanceRemaining: number;
  mode: WeeklyConsumptionMode;
  blockPresent: boolean;
}> {
  const groupWeeklySessions = await getGroupWeeklyScheduleCount(params.groupId);
  const planAllowance = params.planSessionsPerWeek ?? groupWeeklySessions;
  const mode = getWeeklyConsumptionMode(params.planSessionsPerWeek, groupWeeklySessions);

  const sessionsInWeek = await loadGroupWeekSessions(params.groupId, params.sessionDate);
  const attendancesBySessionId = await loadWeekAttendanceStatuses({
    memberId: params.memberId,
    memberSubscriptionId: params.memberSubscriptionId,
    groupId: params.groupId,
    sessionDate: params.sessionDate,
  });

  const weeklyAllowanceRemaining = simulateWeeklyAllowanceRemaining({
    planAllowance,
    mode,
    sessionsInWeek,
    attendancesBySessionId,
    absentConsumesSession: params.absentConsumesSession,
    beforeSessionId: params.sessionId,
  });

  const units = consumptionUnitsForSessionSlot({
    status: params.status,
    mode,
    planAllowance,
    sessionsInWeek,
    attendancesBySessionId,
    absentConsumesSession: params.absentConsumesSession,
    sessionId: params.sessionId,
  });

  return {
    units,
    weeklyAllowanceRemaining,
    mode,
    blockPresent: params.status === "PRESENT" && weeklyAllowanceRemaining <= 0,
  };
}

export async function computeWeeklyAllowanceRemainingForMember(params: {
  sessionId: string;
  groupId: string;
  sessionDate: Date;
  memberId: string;
  memberSubscriptionId: string;
  planSessionsPerWeek: number | null;
  absentConsumesSession: boolean;
  omitSessionId?: string;
}): Promise<number> {
  const groupWeeklySessions = await getGroupWeeklyScheduleCount(params.groupId);
  const planAllowance = params.planSessionsPerWeek ?? groupWeeklySessions;
  const mode = getWeeklyConsumptionMode(params.planSessionsPerWeek, groupWeeklySessions);

  const sessionsInWeek = await loadGroupWeekSessions(params.groupId, params.sessionDate);
  const attendancesBySessionId = await loadWeekAttendanceStatuses({
    memberId: params.memberId,
    memberSubscriptionId: params.memberSubscriptionId,
    groupId: params.groupId,
    sessionDate: params.sessionDate,
    omitSessionId: params.omitSessionId,
  });

  return simulateWeeklyAllowanceRemaining({
    planAllowance,
    mode,
    sessionsInWeek,
    attendancesBySessionId,
    absentConsumesSession: params.absentConsumesSession,
    beforeSessionId: params.sessionId,
  });
}

export async function computeAttendanceConsumptionUnits(params: {
  status: AttendanceStatus;
  sessionId: string;
  groupId: string;
  sessionDate: Date;
  memberId: string;
  memberSubscriptionId: string | null;
  planSessionsPerWeek: number | null;
  absentConsumesSession: boolean;
  /** Treat this session slot as empty (for PATCH recomputation). */
  omitSessionId?: string;
}): Promise<number> {
  if (!params.memberSubscriptionId) {
    if (params.status === "PRESENT") return 1;
    if (params.status === "ABSENT" && params.absentConsumesSession) return 1;
    return 0;
  }

  const groupWeeklySessions = await getGroupWeeklyScheduleCount(params.groupId);
  const planAllowance = params.planSessionsPerWeek ?? groupWeeklySessions;
  const mode = getWeeklyConsumptionMode(params.planSessionsPerWeek, groupWeeklySessions);

  const sessionsInWeek = await loadGroupWeekSessions(params.groupId, params.sessionDate);
  const attendancesBySessionId = await loadWeekAttendanceStatuses({
    memberId: params.memberId,
    memberSubscriptionId: params.memberSubscriptionId,
    groupId: params.groupId,
    sessionDate: params.sessionDate,
    omitSessionId: params.omitSessionId,
  });

  return consumptionUnitsForSessionSlot({
    status: params.status,
    mode,
    planAllowance,
    sessionsInWeek,
    attendancesBySessionId,
    absentConsumesSession: params.absentConsumesSession,
    sessionId: params.sessionId,
  });
}
