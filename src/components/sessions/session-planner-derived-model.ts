import type { GroupedPlanningSection } from "@/components/sessions/session-planner-grouped-sections";
import type { PlannerDayStats, PlannerWeekDay } from "@/components/sessions/session-planner-week-model";
import { formatUtcDateOnlyIso } from "@/lib/dates";
import { formatRoomLabel } from "@/lib/group-room";
import type { SessionDto, SessionStatusDto } from "@/types/session";

export type PlanningViewMode = "week" | "day" | "coach" | "room";

export type PlanningWeekSummary = {
  total: number;
  needsAttendance: number;
  needsFinalization: number;
  completed: number;
  conflicts: number;
  noCoach: number;
  cancelledOrRescheduled: number;
};

export function formatDateFr(dateIso: string) {
  return new Date(dateIso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function sessionDateKey(session: SessionDto) {
  return formatUtcDateOnlyIso(new Date(session.sessionDate));
}

export function isTodaySession(session: SessionDto) {
  return sessionDateKey(session) === formatUtcDateOnlyIso(new Date());
}

export function filterPlannerSessions({
  sessions,
  dayFilter,
  statusFilter,
  searchTerm,
}: {
  sessions: SessionDto[];
  dayFilter: string;
  statusFilter: "ALL" | SessionStatusDto;
  searchTerm: string;
}) {
  const query = searchTerm.trim().toLowerCase();

  return sessions.filter((item) => {
    const sessionDate = new Date(item.sessionDate);
    const day = String(sessionDate.getUTCDay());

    if (dayFilter !== "ALL" && day !== dayFilter) {
      return false;
    }

    if (statusFilter !== "ALL" && item.status !== statusFilter) {
      return false;
    }

    if (!query) {
      return true;
    }

    return (
      item.groupName.toLowerCase().includes(query) ||
      (item.coachName ?? "").toLowerCase().includes(query) ||
      item.room.toLowerCase().includes(query)
    );
  });
}

export function getPlanningWeekSummary({
  sessions,
  conflictSessionIds,
}: {
  sessions: SessionDto[];
  conflictSessionIds: Set<string>;
}): PlanningWeekSummary {
  const needsAttendance = sessions.filter(
    (session) =>
      session.status !== "CANCELLED" &&
      session.status !== "COMPLETED" &&
      (session.operationalStatus === "NEEDS_FINALIZATION" || isTodaySession(session)),
  ).length;

  return {
    total: sessions.length,
    needsAttendance,
    needsFinalization: sessions.filter((session) => session.operationalStatus === "NEEDS_FINALIZATION").length,
    completed: sessions.filter((session) => session.status === "COMPLETED").length,
    conflicts: conflictSessionIds.size,
    noCoach: sessions.filter((session) => !session.coachId).length,
    cancelledOrRescheduled: sessions.filter(
      (session) => session.status === "CANCELLED" || session.status === "RESCHEDULED",
    ).length,
  };
}

export function getRecommendedPlannerSession({
  sessions,
  conflictSessionIds,
}: {
  sessions: SessionDto[];
  conflictSessionIds: Set<string>;
}) {
  return (
    sessions.find((session) => conflictSessionIds.has(session.id)) ??
    sessions.find((session) => session.operationalStatus === "NEEDS_FINALIZATION") ??
    sessions.find((session) => isTodaySession(session)) ??
    sessions[0] ??
    null
  );
}

export function getGroupedPlanningSections({
  viewMode,
  visibleWeekDays,
  sessionsByDate,
  dayStatsByDate,
  sessions,
}: {
  viewMode: PlanningViewMode;
  visibleWeekDays: PlannerWeekDay[];
  sessionsByDate: Map<string, SessionDto[]>;
  dayStatsByDate: Map<string, PlannerDayStats>;
  sessions: SessionDto[];
}): GroupedPlanningSection[] {
  if (viewMode === "week") return [];

  if (viewMode === "day") {
    return visibleWeekDays
      .map((day) => {
        const daySessions = sessionsByDate.get(day.key) ?? [];
        const dayStats = dayStatsByDate.get(day.key);
        return {
          key: day.key,
          label: formatDateFr(`${day.key}T00:00:00`),
          meta: `${dayStats?.total ?? 0} cours · ${dayStats?.expected ?? 0} eleves attendus`,
          sessions: daySessions,
        };
      })
      .filter((section) => section.sessions.length > 0);
  }

  const grouped = new Map<string, { key: string; label: string; sessions: SessionDto[] }>();

  for (const session of sessions) {
    const key = viewMode === "coach" ? (session.coachId ?? "NO_COACH") : formatRoomLabel(session.room);
    const label = viewMode === "coach" ? (session.coachName ?? "Sans coach") : formatRoomLabel(session.room);
    const current = grouped.get(key) ?? { key, label, sessions: [] };
    current.sessions.push(session);
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .sort((a, b) => a.label.localeCompare(b.label, "fr"))
    .map((section) => {
      const days = new Set(section.sessions.map(sessionDateKey)).size;
      return {
        ...section,
        meta: `${section.sessions.length} cours · ${days} jour${days > 1 ? "s" : ""}`,
        sessions: section.sessions.sort((a, b) => {
          const dateSort = sessionDateKey(a).localeCompare(sessionDateKey(b));
          return dateSort || a.startTime.localeCompare(b.startTime);
        }),
      };
    });
}
