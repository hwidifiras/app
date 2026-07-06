import { formatUtcDateOnlyIso } from "@/lib/dates";
import {
  DAY_INDEX_TO_CLUB_DAY,
  DEFAULT_WORKING_DAYS,
  type ClubDay,
} from "@/lib/club-working-days";
import type { SessionDto } from "@/types/session";

export type PlannerWeekDay = {
  key: string;
  dayIndex: number;
  dayOfWeek: ClubDay;
  label: string;
  dateLabel: string;
};

export type PlannerDayStats = {
  total: number;
  expected: number;
  finalization: number;
  conflicts: number;
};

export function getPlannerWeekDays(weekStartIso: string): PlannerWeekDay[] {
  const start = new Date(`${weekStartIso}T12:00:00.000Z`);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);

    return {
      key: formatUtcDateOnlyIso(date),
      dayIndex: date.getUTCDay(),
      dayOfWeek: DAY_INDEX_TO_CLUB_DAY[date.getUTCDay()],
      label: date.toLocaleDateString("fr-FR", { weekday: "short" }),
      dateLabel: date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    };
  });
}

export function getPlannerWorkingDaySet(workingDays: ClubDay[]): Set<ClubDay> {
  return new Set(workingDays.length > 0 ? workingDays : [...DEFAULT_WORKING_DAYS]);
}

export function getSessionDateKeys(sessions: SessionDto[]): Set<string> {
  return new Set(sessions.map((session) => formatUtcDateOnlyIso(new Date(session.sessionDate))));
}

export function getVisiblePlannerWeekDays({
  weekDays,
  dayFilter,
  workingDaySet,
  sessionDateKeys,
}: {
  weekDays: PlannerWeekDay[];
  dayFilter: string;
  workingDaySet: Set<ClubDay>;
  sessionDateKeys: Set<string>;
}) {
  return weekDays.filter((day) => {
    const matchesDayFilter = dayFilter === "ALL" || String(day.dayIndex) === dayFilter;
    if (!matchesDayFilter) return false;
    if (dayFilter !== "ALL") return true;
    return workingDaySet.has(day.dayOfWeek) || sessionDateKeys.has(day.key);
  });
}

export function getHiddenClosedPlannerWeekDays({
  weekDays,
  workingDaySet,
  sessionDateKeys,
}: {
  weekDays: PlannerWeekDay[];
  workingDaySet: Set<ClubDay>;
  sessionDateKeys: Set<string>;
}) {
  return weekDays.filter((day) => !workingDaySet.has(day.dayOfWeek) && !sessionDateKeys.has(day.key));
}

export function getClosedPlannerWeekDaysWithSessions({
  visibleWeekDays,
  workingDaySet,
  sessionDateKeys,
}: {
  visibleWeekDays: PlannerWeekDay[];
  workingDaySet: Set<ClubDay>;
  sessionDateKeys: Set<string>;
}) {
  return visibleWeekDays.filter((day) => !workingDaySet.has(day.dayOfWeek) && sessionDateKeys.has(day.key));
}

export function groupPlannerSessionsByDate({
  visibleWeekDays,
  sessions,
}: {
  visibleWeekDays: PlannerWeekDay[];
  sessions: SessionDto[];
}) {
  const map = new Map<string, SessionDto[]>();

  for (const day of visibleWeekDays) {
    map.set(day.key, []);
  }

  for (const item of sessions) {
    const key = formatUtcDateOnlyIso(new Date(item.sessionDate));
    const current = map.get(key) ?? [];
    current.push(item);
    map.set(key, current);
  }

  for (const daySessions of map.values()) {
    daySessions.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return map;
}

export function getPlannerDayStatsByDate({
  visibleWeekDays,
  sessionsByDate,
  conflictSessionIds,
}: {
  visibleWeekDays: PlannerWeekDay[];
  sessionsByDate: Map<string, SessionDto[]>;
  conflictSessionIds: Set<string>;
}) {
  const stats = new Map<string, PlannerDayStats>();

  for (const day of visibleWeekDays) {
    const daySessions = sessionsByDate.get(day.key) ?? [];
    stats.set(day.key, {
      total: daySessions.length,
      expected: daySessions.reduce((sum, session) => sum + (session.expectedMemberCount ?? 0), 0),
      finalization: daySessions.filter((session) => session.operationalStatus === "NEEDS_FINALIZATION").length,
      conflicts: daySessions.filter((session) => conflictSessionIds.has(session.id)).length,
    });
  }

  return stats;
}

export function getActivePlannerMobileDay({
  selectedMobileDay,
  visibleWeekDays,
  sessionsByDate,
}: {
  selectedMobileDay: string;
  visibleWeekDays: PlannerWeekDay[];
  sessionsByDate: Map<string, SessionDto[]>;
}) {
  if (visibleWeekDays.some((day) => day.key === selectedMobileDay)) {
    return selectedMobileDay;
  }

  const firstDayWithSessions = visibleWeekDays.find((day) => (sessionsByDate.get(day.key) ?? []).length > 0);
  return firstDayWithSessions?.key ?? visibleWeekDays[0]?.key ?? selectedMobileDay;
}
