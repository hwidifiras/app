"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

import { SessionDto, SessionStatusDto } from "@/types/session";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatRoomLabel } from "@/lib/group-room";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { UndoButton } from "@/components/ui/undo-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  PlanningLegend,
  SessionDetailPanel,
  SessionTile,
  formatDateFr,
  isTodaySession,
  sessionDateKey,
} from "@/components/sessions/session-planner-ui";
import {
  FilterField,
  ListSearch,
  MobileFilterSheet,
  MobileFiltersButton,
} from "@/components/ui/list-controls";
import { useActionHistory } from "@/hooks/use-action-history";
import {
  addWeeksToStartIso,
  formatUtcDateOnlyIso,
  getWeekRangeFromStartIso,
  weekEndIsoFromStartIso,
  weekStartIsoForDate,
} from "@/lib/dates";
import { parseApiResponse } from "@/lib/parse-api-response";
import { buildPlanningConflictDetails } from "@/lib/planning-conflicts";
import {
  DAY_INDEX_TO_CLUB_DAY,
  DEFAULT_WORKING_DAYS,
  type ClubDay,
} from "@/lib/club-working-days";
import { cn } from "@/lib/utils";

type SessionsPlannerProps = {
  initialSessions: SessionDto[];
  initialWeekStart: string;
  initialGroupId?: string;
  initialSessionId?: string;
  groupsOptions: Array<{ id: string; name: string; sportId: string }>;
  coachesOptions: Array<{
    id: string;
    firstName: string;
    lastName: string;
    qualifiedSportIds: string[];
    qualifiedSports: Array<{ id: string; name: string; isPrimary: boolean }>;
  }>;
  planningPreferences: {
    allowSameRoomConcurrentGroups: boolean;
    allowCoachConcurrentSameRoomQualified: boolean;
    workingDays: ClubDay[];
  };
};

type PlanningViewMode = "week" | "day" | "coach" | "room";

type SessionGenerationPreview = {
  horizonDays: number;
  dryRun: boolean;
  groupId: string | null;
  startDate: string;
  endDate: string;
  groupCount: number;
  activeScheduleCount: number;
  candidatesCount: number;
  createdCount: number;
  skippedCount: number;
};

function coachOptionLabel(coach: SessionsPlannerProps["coachesOptions"][number]) {
  const qualified = coach.qualifiedSports.map((sport) => sport.name).join(", ");
  const name = `${coach.firstName} ${coach.lastName}`;
  return qualified ? `${name} - ${qualified}` : name;
}

function coachIsQualifiedForSport(
  coach: SessionsPlannerProps["coachesOptions"][number] | undefined,
  sportId?: string,
) {
  if (!coach || !sportId) return true;
  return coach.qualifiedSportIds.includes(sportId);
}

function getWeekDays(weekStartIso: string) {
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

const planningViewModes: Array<{ value: PlanningViewMode; label: string }> = [
  { value: "week", label: "Semaine" },
  { value: "day", label: "Jour" },
  { value: "coach", label: "Coach" },
  { value: "room", label: "Salle" },
];

export function SessionsPlanner({
  initialSessions,
  initialWeekStart,
  initialGroupId = "",
  initialSessionId = "",
  groupsOptions,
  coachesOptions,
  planningPreferences,
}: SessionsPlannerProps) {
  const [sessions, setSessions] = useState<SessionDto[]>(initialSessions);
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [groupId, setGroupId] = useState(initialGroupId);
  const [dayFilter, setDayFilter] = useState("ALL");
  const [selectedMobileDay, setSelectedMobileDay] = useState(initialWeekStart);
  const [statusFilter, setStatusFilter] = useState<"ALL" | SessionStatusDto>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<PlanningViewMode>("week");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationPreview, setGenerationPreview] = useState<SessionGenerationPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDeleteSession, setPendingDeleteSession] = useState<SessionDto | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  const [editingSession, setEditingSession] = useState<SessionDto | null>(null);
  const [editForm, setEditForm] = useState({
    sessionDate: "",
    coachId: "",
    room: "",
    startTime: "",
    endTime: "",
    status: "" as SessionStatusDto | "",
    exceptionReason: "",
    changeReason: "",
    coachSportOverrideReason: "",
  });
  const [editMode, setEditMode] = useState<"exception" | "permanent" | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  const deepLinkHandled = useRef(false);
  const { push, undoLast, loading: undoLoading, canUndo } = useActionHistory({ enableKeyboard: true });

  const weekEnd = useMemo(() => weekEndIsoFromStartIso(weekStart), [weekStart]);
  const editingHasAttendances = (editingSession?.attendanceCount ?? 0) > 0;
  const selectedEditCoach = coachesOptions.find((coach) => coach.id === editForm.coachId);
  const editCoachChanged = Boolean(editingSession && editForm.coachId !== (editingSession.coachId ?? ""));
  const needsCoachSportOverride = Boolean(
    editingSession &&
      editForm.coachId &&
      editCoachChanged &&
      !coachIsQualifiedForSport(selectedEditCoach, editingSession.groupSportId),
  );

  useEffect(() => {
    if (deepLinkHandled.current || !initialSessionId) return;

    const session = sessions.find((item) => item.id === initialSessionId);
    if (!session) return;

    deepLinkHandled.current = true;
    openEdit(session);
  }, [initialSessionId, sessions]);

  async function reloadSessions(nextWeekStart: string, nextGroupId: string) {
    setLoading(true);
    setMessage(null);

    const { start, end } = getWeekRangeFromStartIso(nextWeekStart);

    const params = new URLSearchParams({
      from: start.toISOString(),
      to: end.toISOString(),
    });

    if (nextGroupId) {
      params.set("groupId", nextGroupId);
    }

    const response = await fetch(`/api/sessions?${params.toString()}`, { cache: "no-store" });
    const result = await parseApiResponse<{ data?: SessionDto[]; error?: string }>(response);

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors du chargement du planning");
      setLoading(false);
      return;
    }

    setSessions(result.data ?? []);
    setLoading(false);
  }

  async function goToWeek(offsetWeeks: number) {
    const nextWeekStart = addWeeksToStartIso(weekStart, offsetWeeks);
    setWeekStart(nextWeekStart);
    await reloadSessions(nextWeekStart, groupId);
  }

  async function resetCurrentWeek() {
    const currentMonday = weekStartIsoForDate(new Date());
    setWeekStart(currentMonday);
    await reloadSessions(currentMonday, groupId);
  }

  async function onGroupChange(nextGroupId: string) {
    setGroupId(nextGroupId);
    setGenerationPreview(null);
    await reloadSessions(weekStart, nextGroupId);
  }

  function openEdit(session: SessionDto) {
    setExpandedSessionId(session.id);
    setEditingSession(session);
    setEditForm({
      sessionDate: formatUtcDateOnlyIso(new Date(session.sessionDate)),
      coachId: session.coachId ?? "",
      room: session.room,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      exceptionReason: session.exceptionReason ?? "",
      changeReason: "",
      coachSportOverrideReason: "",
    });
    setEditMode("exception");
    setEditMessage(null);
  }

  function closeEdit() {
    setEditingSession(null);
    setEditMode(null);
    setEditLoading(false);
    setEditMessage(null);
  }

  async function saveEdit() {
    if (!editingSession) return;
    setEditLoading(true);
    setEditMessage(null);

    const originalDateIso = formatUtcDateOnlyIso(new Date(editingSession.sessionDate));
    const body: Record<string, unknown> = { editMode };

    if (editMode === "permanent") {
      body.startTime = editForm.startTime;
      body.endTime = editForm.endTime;
      body.room = editForm.room;
      body.status = editForm.status;
      body.coachId = editForm.coachId ? editForm.coachId : null;
      if (editForm.sessionDate && editForm.sessionDate !== originalDateIso) {
        body.sessionDate = new Date(`${editForm.sessionDate}T12:00:00`).toISOString();
      }
      if (editForm.status === "CANCELLED" && editForm.exceptionReason.trim()) {
        body.exceptionReason = editForm.exceptionReason.trim();
      }
      body.changeReason = editForm.changeReason.trim();
      if (needsCoachSportOverride) {
        body.coachSportOverrideReason = editForm.coachSportOverrideReason.trim();
      }
    } else {
      if (editForm.sessionDate && editForm.sessionDate !== originalDateIso) {
        body.sessionDate = new Date(`${editForm.sessionDate}T12:00:00`).toISOString();
      }
      if (editForm.coachId !== (editingSession.coachId ?? "")) {
        body.coachId = editForm.coachId ? editForm.coachId : null;
      }
      if (editForm.room !== editingSession.room) {
        body.room = editForm.room;
      }
      if (editForm.startTime !== editingSession.startTime) {
        body.startTime = editForm.startTime;
      }
      if (editForm.endTime !== editingSession.endTime) {
        body.endTime = editForm.endTime;
      }
      if (editForm.status !== editingSession.status) {
        body.status = editForm.status;
      }
      if (editForm.exceptionReason !== (editingSession.exceptionReason ?? "")) {
        body.exceptionReason = editForm.exceptionReason;
      }
      if (needsCoachSportOverride) {
        body.coachSportOverrideReason = editForm.coachSportOverrideReason.trim();
      }
    }

    const response = await fetch(`/api/sessions/${editingSession.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await parseApiResponse<{ data?: SessionDto; error?: string }>(response);

    if (!response.ok) {
      setEditMessage(result.error ?? "Erreur lors de la modification");
      setEditLoading(false);
      return;
    }

    const undoSnapshot =
      editMode === "exception"
        ? {
            sessionId: editingSession.id,
            weekStart,
            groupId,
            previous: {
              sessionDate: editingSession.sessionDate,
              coachId: editingSession.coachId,
              room: editingSession.room,
              startTime: editingSession.startTime,
              endTime: editingSession.endTime,
              status: editingSession.status,
              exceptionReason: editingSession.exceptionReason,
            },
          }
        : null;

    const updated = result.data;

    if (editMode === "permanent") {
      const targetWeek = updated?.sessionDate
        ? weekStartIsoForDate(new Date(updated.sessionDate))
        : weekStart;
      if (targetWeek !== weekStart) {
        setWeekStart(targetWeek);
      }
      await reloadSessions(targetWeek, groupId);
    } else if (updated?.sessionDate) {
      const targetWeek = weekStartIsoForDate(new Date(updated.sessionDate));
      if (targetWeek !== weekStart) {
        setWeekStart(targetWeek);
        await reloadSessions(targetWeek, groupId);
      } else {
        setSessions((current) =>
          current.map((s) => (s.id === editingSession.id ? { ...s, ...updated } : s)),
        );
      }
    }

    setEditMessage(
      editMode === "permanent"
        ? "Créneau mis à jour pour cette séance et les suivantes"
        : "Séance modifiée avec succès",
    );
    setEditLoading(false);

    if (undoSnapshot && updated) {
      push({
        scope: "session-edit",
        label: "Modification séance",
        undo: async () => {
          const revertResponse = await fetch(`/api/sessions/${undoSnapshot.sessionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              editMode: "exception",
              sessionDate: undoSnapshot.previous.sessionDate,
              coachId: undoSnapshot.previous.coachId,
              room: undoSnapshot.previous.room,
              startTime: undoSnapshot.previous.startTime,
              endTime: undoSnapshot.previous.endTime,
              status: undoSnapshot.previous.status,
              exceptionReason: undoSnapshot.previous.exceptionReason ?? "",
            }),
          });
          const revertResult = await parseApiResponse<{ data?: SessionDto; error?: string }>(revertResponse);
          if (!revertResponse.ok) {
            setMessage(revertResult.error ?? "Impossible d'annuler la modification.");
            return false;
          }

          const reverted = revertResult.data;
          if (reverted?.sessionDate) {
            const targetWeek = weekStartIsoForDate(new Date(reverted.sessionDate));
            if (targetWeek !== weekStart) {
              setWeekStart(targetWeek);
              await reloadSessions(targetWeek, groupId);
            } else {
              setSessions((current) =>
                current.map((session) =>
                  session.id === undoSnapshot.sessionId ? { ...session, ...reverted } : session,
                ),
              );
            }
          }

          setMessage("Modification de séance annulée.");
          return true;
        },
      });
      setMessage("Séance modifiée avec succès");
    }

    setTimeout(() => closeEdit(), 600);
  }

  async function deleteSession(sessionId: string) {
    setLoading(true);
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: "DELETE",
    });

    const result = await parseApiResponse<{
      data?: { id: string; status: SessionStatusDto; exceptionReason: string | null; updatedAt: string };
      error?: string;
    }>(response);

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de l'annulation");
      setLoading(false);
      return;
    }

    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              status: result.data?.status ?? "CANCELLED",
              operationalStatus: "CANCELLED",
              exceptionReason: result.data?.exceptionReason ?? "Annulation depuis le planning",
              updatedAt: result.data?.updatedAt ?? new Date().toISOString(),
            }
          : session,
      ),
    );
    setPendingDeleteSession(null);
    setExpandedSessionId(null);
    setMessage("Séance annulée avec succès");
    setLoading(false);
  }

  function toggleExpandedSession(session: SessionDto) {
    setExpandedSessionId((current) => (current === session.id ? null : session.id));
  }

  function buildGenerationBody(dryRun: boolean) {
    const body: Record<string, unknown> = { horizonDays: 56, dryRun };
    if (groupId) {
      body.groupId = groupId;
    }
    return body;
  }

  async function previewSessionsGeneration() {
    setGenerating(true);
    setMessage(null);
    setGenerationPreview(null);

    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildGenerationBody(true)),
    });
    const result = await parseApiResponse<{
      data?: SessionGenerationPreview;
      error?: string;
    }>(response);

    if (!response.ok) {
      setMessage(result.error ?? "Impossible de preparer la generation.");
      setGenerating(false);
      return;
    }

    setGenerationPreview(result.data ?? null);
    setGenerating(false);
  }

  async function generateSessions() {
    setGenerating(true);
    setMessage(null);

    const body = buildGenerationBody(false);

    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await parseApiResponse<{
      data?: SessionGenerationPreview;
      error?: string;
    }>(response);

    if (!response.ok) {
      setMessage(result.error ?? "Impossible de créer les séances.");
      setGenerating(false);
      return;
    }

    await reloadSessions(weekStart, groupId);
    const created = result.data?.createdCount ?? 0;
    const skipped = result.data?.skippedCount ?? 0;
    setGenerationPreview(null);
    setMessage(
      `${created} séance${created > 1 ? "s" : ""} créée${created > 1 ? "s" : ""}, ${skipped} déjà existante${skipped > 1 ? "s" : ""}.`,
    );
    setGenerating(false);
  }

  const filteredSessions = useMemo(() => {
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
  }, [dayFilter, searchTerm, sessions, statusFilter]);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const workingDaySet = useMemo(() => {
    const selected = planningPreferences.workingDays.length > 0
      ? planningPreferences.workingDays
      : [...DEFAULT_WORKING_DAYS];
    return new Set<ClubDay>(selected);
  }, [planningPreferences.workingDays]);
  const filteredSessionDateKeys = useMemo(
    () => new Set(filteredSessions.map((session) => sessionDateKey(session))),
    [filteredSessions],
  );
  const visibleWeekDays = useMemo(
    () => weekDays.filter((day) => {
      const matchesDayFilter = dayFilter === "ALL" || String(day.dayIndex) === dayFilter;
      if (!matchesDayFilter) return false;
      if (dayFilter !== "ALL") return true;
      return workingDaySet.has(day.dayOfWeek) || filteredSessionDateKeys.has(day.key);
    }),
    [dayFilter, filteredSessionDateKeys, weekDays, workingDaySet],
  );
  const hiddenClosedDays = useMemo(
    () => weekDays.filter((day) => !workingDaySet.has(day.dayOfWeek) && !filteredSessionDateKeys.has(day.key)),
    [filteredSessionDateKeys, weekDays, workingDaySet],
  );
  const closedDaysWithSessions = useMemo(
    () => visibleWeekDays.filter((day) => !workingDaySet.has(day.dayOfWeek) && filteredSessionDateKeys.has(day.key)),
    [filteredSessionDateKeys, visibleWeekDays, workingDaySet],
  );
  const sessionsByDate = useMemo(() => {
    const map = new Map<string, SessionDto[]>();

    for (const day of visibleWeekDays) {
      map.set(day.key, []);
    }

    for (const item of filteredSessions) {
      const key = formatUtcDateOnlyIso(new Date(item.sessionDate));
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    }

    for (const daySessions of map.values()) {
      daySessions.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }

    return map;
  }, [filteredSessions, visibleWeekDays]);

  const conflictDetailsBySessionId = useMemo(() => {
    return buildPlanningConflictDetails({
      sessions: filteredSessions,
      coaches: coachesOptions,
      preferences: planningPreferences,
    });
  }, [coachesOptions, filteredSessions, planningPreferences]);

  const conflictSessionIds = useMemo(
    () => new Set(conflictDetailsBySessionId.keys()),
    [conflictDetailsBySessionId],
  );

  const weekSummary = useMemo(() => {
    const needsAttendance = filteredSessions.filter((session) =>
      session.status !== "CANCELLED" &&
      session.status !== "COMPLETED" &&
      (session.operationalStatus === "NEEDS_FINALIZATION" || isTodaySession(session)),
    ).length;
    return {
      total: filteredSessions.length,
      needsAttendance,
      needsFinalization: filteredSessions.filter((session) => session.operationalStatus === "NEEDS_FINALIZATION").length,
      completed: filteredSessions.filter((session) => session.status === "COMPLETED").length,
      conflicts: conflictSessionIds.size,
      noCoach: filteredSessions.filter((session) => !session.coachId).length,
      cancelledOrRescheduled: filteredSessions.filter((session) => session.status === "CANCELLED" || session.status === "RESCHEDULED").length,
    };
  }, [conflictSessionIds.size, filteredSessions]);

  const dayStatsByDate = useMemo(() => {
    const stats = new Map<string, { total: number; expected: number; finalization: number; conflicts: number }>();

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
  }, [conflictSessionIds, sessionsByDate, visibleWeekDays]);

  const activeMobileDay = useMemo(() => {
    if (visibleWeekDays.some((day) => day.key === selectedMobileDay)) {
      return selectedMobileDay;
    }

    const firstDayWithSessions = visibleWeekDays.find((day) => (sessionsByDate.get(day.key) ?? []).length > 0);
    return firstDayWithSessions?.key ?? visibleWeekDays[0]?.key ?? selectedMobileDay;
  }, [selectedMobileDay, sessionsByDate, visibleWeekDays]);

  const firstConflictSession = useMemo(
    () => filteredSessions.find((session) => conflictSessionIds.has(session.id)) ?? null,
    [conflictSessionIds, filteredSessions],
  );

  const recommendedSession = useMemo(() => {
    return firstConflictSession ??
      filteredSessions.find((session) => session.operationalStatus === "NEEDS_FINALIZATION") ??
      filteredSessions.find((session) => isTodaySession(session)) ??
      filteredSessions[0] ??
      null;
  }, [filteredSessions, firstConflictSession]);

  const selectedSession = useMemo(() => {
    return filteredSessions.find((session) => session.id === expandedSessionId) ?? recommendedSession;
  }, [expandedSessionId, filteredSessions, recommendedSession]);

  const groupedPlanningSections = useMemo(() => {
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

    for (const session of filteredSessions) {
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
  }, [dayStatsByDate, filteredSessions, sessionsByDate, viewMode, visibleWeekDays]);

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, SessionDto[]>();

    for (const item of filteredSessions) {
      const key = formatUtcDateOnlyIso(new Date(item.sessionDate));
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    }

    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, daySessions]) => [
      key,
      daySessions.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    ] as const);
  }, [filteredSessions]);

  const activeFilterCount = [
    Boolean(groupId),
    dayFilter !== "ALL",
    statusFilter !== "ALL",
  ].filter(Boolean).length;

  const renderSessionTile = (item: SessionDto) => (
    <SessionTile
      key={item.id}
      item={item}
      onEdit={openEdit}
      onCancel={setPendingDeleteSession}
      onToggle={toggleExpandedSession}
      expanded={expandedSessionId === item.id}
      conflictReasons={conflictDetailsBySessionId.get(item.id) ?? []}
      hasConflict={conflictSessionIds.has(item.id)}
    />
  );

  function focusFirstConflict() {
    if (!firstConflictSession) return;
    setExpandedSessionId(firstConflictSession.id);
    setSelectedMobileDay(sessionDateKey(firstConflictSession));
    setViewMode("week");
  }

  async function resetFilters() {
    setDayFilter("ALL");
    setStatusFilter("ALL");
    if (groupId) {
      await onGroupChange("");
    }
  }

  const generationTargetLabel = generationPreview?.groupId
    ? groupsOptions.find((group) => group.id === generationPreview.groupId)?.name ?? "Groupe selectionne"
    : "Tous les groupes actifs";

  return (
    <div>
      <section className="panel p-3 sm:p-5">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Planning semaine</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">Command center des cours</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Semaine du {formatDateFr(`${weekStart}T12:00:00.000Z`)} au {formatDateFr(`${weekEnd}T12:00:00.000Z`)}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-[auto_auto_auto_auto] xl:justify-end">
            <button type="button" onClick={() => { void goToWeek(-1); }} className="btn btn-ghost px-3" aria-label="Semaine précédente">
              <ChevronLeft className="size-4" />
              <span className="hidden sm:inline">Précédente</span>
            </button>
            <button type="button" onClick={() => { void resetCurrentWeek(); }} className="btn btn-ghost">
              Aujourd&apos;hui
            </button>
            <button type="button" onClick={() => { void goToWeek(1); }} className="btn btn-ghost px-3" aria-label="Semaine suivante">
              <span className="hidden sm:inline">Suivante</span>
              <ChevronRight className="size-4" />
            </button>
            <button type="button" onClick={() => { void previewSessionsGeneration(); }} disabled={generating || loading} className="btn btn-primary">
              <CalendarPlus className="size-4" />
              {generating ? "Analyse..." : "Préparer séances"}
            </button>
          </div>
        </div>

        {generationPreview ? (
          <div className="mt-4 rounded-lg border border-[var(--primary)]/25 bg-[var(--primary)]/5 p-4 shadow-[var(--shadow-panel)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
                  Apercu generation
                </p>
                <h3 className="mt-1 text-base font-black text-[var(--foreground)]">
                  {generationPreview.createdCount > 0
                    ? `${generationPreview.createdCount} seance${generationPreview.createdCount > 1 ? "s" : ""} a creer`
                    : "Aucune nouvelle seance a creer"}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
                  Cible: {generationTargetLabel}. Periode du {formatDateFr(generationPreview.startDate)} au{" "}
                  {formatDateFr(generationPreview.endDate)}. Les seances deja existantes seront ignorees.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[20rem]">
                <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                    Horaires actifs
                  </p>
                  <p className="mt-1 text-lg font-black text-[var(--foreground)]">{generationPreview.activeScheduleCount}</p>
                </div>
                <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                  <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
                    Deja existantes
                  </p>
                  <p className="mt-1 text-lg font-black text-[var(--foreground)]">{generationPreview.skippedCount}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn btn-ghost btn-block-mobile" onClick={() => setGenerationPreview(null)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn btn-primary btn-block-mobile"
                disabled={generating || generationPreview.createdCount === 0}
                onClick={() => { void generateSessions(); }}
              >
                {generating ? "Creation..." : `Generer ${generationPreview.createdCount} seance${generationPreview.createdCount > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Cours</p>
            <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{weekSummary.total}</p>
          </div>
          <div className="rounded-lg border border-[var(--warning)]/25 bg-[var(--warning)]/10 px-3 py-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--warning)]">À traiter</p>
            <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{weekSummary.needsFinalization}</p>
          </div>
          <div className="rounded-lg border border-[var(--success)]/25 bg-[var(--success)]/10 px-3 py-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--success)]">Terminés</p>
            <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{weekSummary.completed}</p>
          </div>
          <div className="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/10 px-3 py-2">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--danger)]">Conflits</p>
            <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{weekSummary.conflicts}</p>
          </div>
        </div>

        {(weekSummary.noCoach > 0 || weekSummary.cancelledOrRescheduled > 0 || weekSummary.needsAttendance > 0) ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {weekSummary.needsAttendance > 0 ? (
              <span className="rounded-full bg-[var(--primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--primary)]">
                {weekSummary.needsAttendance} à pointer
              </span>
            ) : null}
            {weekSummary.noCoach > 0 ? (
              <span className="rounded-full bg-[var(--warning)]/10 px-3 py-1 text-xs font-semibold text-[var(--warning)]">
                {weekSummary.noCoach} sans coach
              </span>
            ) : null}
            {weekSummary.cancelledOrRescheduled > 0 ? (
              <span className="rounded-full bg-[var(--muted-surface)] px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
                {weekSummary.cancelledOrRescheduled} annulé/reporté
              </span>
            ) : null}
          </div>
        ) : null}

        {weekSummary.conflicts > 0 ? (
          <div className="mt-3 flex flex-col gap-3 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/10 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-bold text-[var(--danger)]">{weekSummary.conflicts} conflit{weekSummary.conflicts > 1 ? "s" : ""} à corriger</p>
              <p className="mt-0.5 text-xs text-[var(--foreground)]">
                Un coach ou une salle est utilisé sur deux cours qui se chevauchent.
              </p>
            </div>
            <button type="button" onClick={focusFirstConflict} className="btn btn-ghost btn-sm shrink-0 border-[var(--danger)]/30 text-[var(--danger)]">
              Voir le premier conflit
            </button>
          </div>
        ) : null}

        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2 md:flex-row md:items-center md:justify-between">
          <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap">
            {planningViewModes.map((mode) => (
              <button
                key={mode.value}
                type="button"
                onClick={() => setViewMode(mode.value)}
                className={cn(
                  "rounded-md px-3 py-2 text-xs font-bold transition",
                  viewMode === mode.value
                    ? "bg-[var(--primary)] text-white shadow-sm"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <PlanningLegend />
        </div>

        <div className="list-toolbar sticky top-[57px] z-20 -mx-2 mt-3 border-b border-[var(--border)] bg-[var(--surface)]/96 px-2 pb-3 pt-1 backdrop-blur lg:top-[3.5rem]">
          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Recherche</label>
              <ListSearch
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Groupe, coach ou salle..."
              />
            </div>
            <MobileFiltersButton onClick={() => setFiltersOpen(true)} count={activeFilterCount} />
            <div className="hidden grid-cols-[minmax(11rem,1fr)_minmax(9rem,0.7fr)_minmax(10rem,0.8fr)_auto] items-end gap-2 md:grid">
              <FilterField label="Groupe">
                <select value={groupId} onChange={(event) => { void onGroupChange(event.target.value); }} className="field text-xs">
                  <option value="">Tous les groupes</option>
                  {groupsOptions.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
              </FilterField>
              <FilterField label="Jour">
                <select value={dayFilter} onChange={(event) => setDayFilter(event.target.value)} className="field text-xs">
                  <option value="ALL">Tous les jours</option>
                  <option value="1">Lundi</option><option value="2">Mardi</option><option value="3">Mercredi</option>
                  <option value="4">Jeudi</option><option value="5">Vendredi</option><option value="6">Samedi</option><option value="0">Dimanche</option>
                </select>
              </FilterField>
              <FilterField label="Statut">
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "ALL" | SessionStatusDto)} className="field text-xs">
                  <option value="ALL">Tous les statuts</option>
                  <option value="PLANNED">Planifiées</option><option value="RESCHEDULED">Reportées</option>
                  <option value="CANCELLED">Annulées</option><option value="COMPLETED">Terminées</option>
                </select>
              </FilterField>
              {activeFilterCount > 0 ? (
                <button type="button" onClick={() => { void resetFilters(); }} className="btn btn-ghost px-3" title="Réinitialiser">
                  <RotateCcw className="size-4" />
                </button>
              ) : <span />}
            </div>
          </div>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            {filteredSessions.length} séance{filteredSessions.length > 1 ? "s" : ""} affichée{filteredSessions.length > 1 ? "s" : ""}
          </p>
          {dayFilter === "ALL" && (hiddenClosedDays.length > 0 || closedDaysWithSessions.length > 0) ? (
            <div className="mt-2 flex flex-col gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                {hiddenClosedDays.length > 0 ? (
                  <span className="font-semibold">
                    {hiddenClosedDays.length} jour{hiddenClosedDays.length > 1 ? "s" : ""} fermé{hiddenClosedDays.length > 1 ? "s" : ""} sans cours masqué{hiddenClosedDays.length > 1 ? "s" : ""}.
                  </span>
                ) : null}
                {closedDaysWithSessions.length > 0 ? (
                  <span className={hiddenClosedDays.length > 0 ? "ml-1" : "font-semibold"}>
                    {closedDaysWithSessions.length} jour{closedDaysWithSessions.length > 1 ? "s" : ""} fermé{closedDaysWithSessions.length > 1 ? "s" : ""} reste{closedDaysWithSessions.length > 1 ? "nt" : ""} visible{closedDaysWithSessions.length > 1 ? "s" : ""} car des séances existent dessus.
                  </span>
                ) : null}
              </div>
              <Link href="/settings/club" prefetch={false} className="shrink-0 font-bold text-[var(--primary)] hover:underline">
                Régler les jours
              </Link>
            </div>
          ) : null}
        </div>

        {loading ? <p className="mt-4 text-sm text-[var(--muted-foreground)]">Chargement du planning...</p> : null}
        <FeedbackMessage message={message} className="mt-4" />
        {canUndo ? (
          <div className="mt-2">
            <UndoButton
              onClick={() => undoLast()}
              disabled={undoLoading || loading}
              label="Annuler la dernière modification"
              title="Annuler la dernière modification de séance (Ctrl+Z)"
            />
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_22rem] 2xl:items-start">
          <div className="min-w-0">
            {filteredSessions.length > 0 ? (
              viewMode === "week" ? (
                <>
                  <div
                    className="hidden items-start gap-2 lg:grid"
                    style={{ gridTemplateColumns: `repeat(${Math.max(visibleWeekDays.length, 1)}, minmax(0, 1fr))` }}
                  >
                    {visibleWeekDays.map((day) => {
                      const daySessions = sessionsByDate.get(day.key) ?? [];
                      const dayStats = dayStatsByDate.get(day.key);

                      return (
                        <section key={day.key} className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-2 shadow-[var(--shadow-panel)]">
                          <div className="rounded-md bg-[var(--surface-soft)] px-2 py-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-xs font-bold capitalize text-[var(--foreground)]">{day.label}</p>
                                <p className="text-[0.7rem] text-[var(--muted-foreground)]">{day.dateLabel}</p>
                              </div>
                              <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--muted-foreground)]">
                                {dayStats?.total ?? 0}
                              </span>
                            </div>
                            {daySessions.length > 0 ? (
                              <div className="mt-2 flex flex-wrap gap-1">
                                <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[0.62rem] font-semibold text-[var(--primary)]">
                                  {dayStats?.expected ?? 0} eleves
                                </span>
                                {(dayStats?.finalization ?? 0) > 0 ? (
                                  <span className="rounded-full bg-[var(--warning)]/10 px-2 py-0.5 text-[0.62rem] font-semibold text-[var(--warning)]">
                                    {dayStats?.finalization} a finaliser
                                  </span>
                                ) : null}
                                {(dayStats?.conflicts ?? 0) > 0 ? (
                                  <span className="rounded-full bg-[var(--danger)]/10 px-2 py-0.5 text-[0.62rem] font-semibold text-[var(--danger)]">
                                    {dayStats?.conflicts} conflit
                                  </span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          {daySessions.length > 0 ? (
                            <ul className="mt-2 space-y-2">
                              {daySessions.map(renderSessionTile)}
                            </ul>
                          ) : (
                            <div className="mt-2 rounded-lg border border-dashed border-[var(--border)] px-2 py-4 text-center text-xs text-[var(--muted-foreground)]">
                              Aucun cours
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>

                  <div className="min-w-0 space-y-3 overflow-hidden lg:hidden">
                    <div className="-mx-1 flex max-w-full min-w-0 gap-2 overflow-x-auto px-1 pb-1">
                      {visibleWeekDays.map((day) => {
                        const dayStats = dayStatsByDate.get(day.key);
                        const active = activeMobileDay === day.key;
                        return (
                          <button
                            key={day.key}
                            type="button"
                            onClick={() => setSelectedMobileDay(day.key)}
                            className={cn(
                              "min-w-[4.75rem] rounded-lg border px-2 py-2 text-center transition",
                              active
                                ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                                : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]",
                            )}
                          >
                            <span className="block truncate text-[0.68rem] font-bold capitalize">{day.label}</span>
                            <span className={cn("block text-[0.68rem]", active ? "text-white/80" : "text-[var(--muted-foreground)]")}>
                              {dayStats?.total ?? 0} cours
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {visibleWeekDays.filter((day) => day.key === activeMobileDay).map((day) => {
                      const daySessions = sessionsByDate.get(day.key) ?? [];
                      const dayStats = dayStatsByDate.get(day.key);
                      return (
                        <section key={day.key} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3.5 shadow-[var(--shadow-panel)] sm:p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold capitalize text-[var(--foreground)]">{formatDateFr(`${day.key}T00:00:00`)}</h3>
                              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                                {dayStats?.expected ?? 0} eleves attendus · {dayStats?.finalization ?? 0} a finaliser
                              </p>
                            </div>
                            {(dayStats?.conflicts ?? 0) > 0 ? (
                              <StatusBadge variant="danger">{dayStats?.conflicts} conflit</StatusBadge>
                            ) : null}
                          </div>

                          {daySessions.length > 0 ? (
                            <ul className="mt-3 grid gap-2">
                              {daySessions.map(renderSessionTile)}
                            </ul>
                          ) : (
                            <div className="mt-3 rounded-lg border border-dashed border-[var(--border)] px-3 py-5 text-center text-xs text-[var(--muted-foreground)]">
                              Aucun cours
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="grid gap-3">
                  {groupedPlanningSections.map((section) => (
                    <section key={section.key} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3 shadow-[var(--shadow-panel)]">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-bold text-[var(--foreground)]">{section.label}</h3>
                          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{section.meta}</p>
                        </div>
                        <StatusBadge variant={section.sessions.some((session) => conflictSessionIds.has(session.id)) ? "danger" : "muted"}>
                          {section.sessions.length} cours
                        </StatusBadge>
                      </div>
                      <ul className="mt-3 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                        {section.sessions.map(renderSessionTile)}
                      </ul>
                    </section>
                  ))}
                </div>
              )
            ) : (
              <EmptyState
                icon={<CalendarDays className="size-8 opacity-45" />}
                title="Aucune séance trouvée"
                message="Changez de semaine ou réinitialisez les filtres."
                action={
                  <button type="button" onClick={() => { setSearchTerm(""); void resetFilters(); }} className="btn btn-ghost">
                    Réinitialiser
                  </button>
                }
              />
            )}
          </div>

          {filteredSessions.length > 0 ? (
            <SessionDetailPanel
              session={selectedSession}
              conflictReasons={selectedSession ? conflictDetailsBySessionId.get(selectedSession.id) ?? [] : []}
              onEdit={openEdit}
              onCancel={setPendingDeleteSession}
              className="hidden 2xl:sticky 2xl:top-28 2xl:block"
            />
          ) : null}
        </div>

        {filteredSessions.length > 0 ? (
          <SessionDetailPanel
            session={selectedSession}
            conflictReasons={selectedSession ? conflictDetailsBySessionId.get(selectedSession.id) ?? [] : []}
            onEdit={openEdit}
            onCancel={setPendingDeleteSession}
            className="mt-4 2xl:hidden"
          />
        ) : null}

        <div className="hidden" aria-hidden="true">
          {filteredSessions.length > 0 ? (
            <div className="hidden items-start gap-2 lg:grid lg:grid-cols-7">
              {visibleWeekDays.map((day) => {
                const daySessions = sessionsByDate.get(day.key) ?? [];
                const dayStats = dayStatsByDate.get(day.key);

                return (
                  <section key={day.key} className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-2 shadow-[var(--shadow-panel)]">
                    <div className="rounded-md bg-[var(--surface-soft)] px-2 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold capitalize text-[var(--foreground)]">{day.label}</p>
                          <p className="text-[0.7rem] text-[var(--muted-foreground)]">{day.dateLabel}</p>
                        </div>
                        <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--muted-foreground)]">
                          {dayStats?.total ?? 0}
                        </span>
                      </div>
                      {daySessions.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[0.62rem] font-semibold text-[var(--primary)]">
                            {dayStats?.expected ?? 0} élèves
                          </span>
                          {(dayStats?.finalization ?? 0) > 0 ? (
                            <span className="rounded-full bg-[var(--warning)]/10 px-2 py-0.5 text-[0.62rem] font-semibold text-[var(--warning)]">
                              {dayStats?.finalization} à finaliser
                            </span>
                          ) : null}
                          {(dayStats?.conflicts ?? 0) > 0 ? (
                            <span className="rounded-full bg-[var(--danger)]/10 px-2 py-0.5 text-[0.62rem] font-semibold text-[var(--danger)]">
                              {dayStats?.conflicts} conflit
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    {daySessions.length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {daySessions.map((item) => (
                          <SessionTile
                            key={item.id}
                            item={item}
                            onEdit={openEdit}
                            onCancel={setPendingDeleteSession}
                            onToggle={toggleExpandedSession}
                            expanded={expandedSessionId === item.id}
                            conflictReasons={conflictDetailsBySessionId.get(item.id) ?? []}
                            hasConflict={conflictSessionIds.has(item.id)}
                          />
                        ))}
                      </ul>
                    ) : (
                      <div className="mt-2 rounded-lg border border-dashed border-[var(--border)] px-2 py-6 text-center text-xs text-[var(--muted-foreground)]">
                        Aucun cours
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          ) : null}

          <div className="min-w-0 space-y-3 overflow-hidden lg:hidden">
            <div className="flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1">
              {visibleWeekDays.map((day) => {
                const dayStats = dayStatsByDate.get(day.key);
                const active = activeMobileDay === day.key;
                return (
                  <button
                    key={day.key}
                    type="button"
                    onClick={() => setSelectedMobileDay(day.key)}
                    className={`min-w-20 rounded-lg border px-3 py-2 text-left transition ${
                      active
                        ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
                    }`}
                  >
                    <span className="block text-xs font-bold capitalize">{day.label}</span>
                    <span className={`block text-[0.68rem] ${active ? "text-white/80" : "text-[var(--muted-foreground)]"}`}>
                      {dayStats?.total ?? 0} cours
                    </span>
                  </button>
                );
              })}
            </div>

            {visibleWeekDays.filter((day) => day.key === activeMobileDay).map((day) => {
              const daySessions = sessionsByDate.get(day.key) ?? [];
              const dayStats = dayStatsByDate.get(day.key);
              return (
                <section key={day.key} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3.5 shadow-[var(--shadow-panel)] sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold capitalize text-[var(--foreground)]">{formatDateFr(`${day.key}T00:00:00`)}</h3>
                      <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                        {dayStats?.expected ?? 0} élèves attendus · {dayStats?.finalization ?? 0} à finaliser
                      </p>
                    </div>
                    {(dayStats?.conflicts ?? 0) > 0 ? (
                      <StatusBadge variant="danger">{dayStats?.conflicts} conflit</StatusBadge>
                    ) : null}
                  </div>

                  {daySessions.length > 0 ? (
                    <ul className="mt-3 grid gap-2">
                      {daySessions.map((item) => (
                        <SessionTile
                          key={item.id}
                          item={item}
                          onEdit={openEdit}
                          onCancel={setPendingDeleteSession}
                          onToggle={toggleExpandedSession}
                          expanded={expandedSessionId === item.id}
                          conflictReasons={conflictDetailsBySessionId.get(item.id) ?? []}
                          hasConflict={conflictSessionIds.has(item.id)}
                        />
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-3 rounded-lg border border-dashed border-[var(--border)] px-3 py-5 text-center text-xs text-[var(--muted-foreground)]">
                      Aucun cours
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          {sessionsByDay.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="size-8 opacity-45" />}
              title="Aucune séance trouvée"
              message="Changez de semaine ou réinitialisez les filtres."
              action={
                <button type="button" onClick={() => { setSearchTerm(""); void resetFilters(); }} className="btn btn-ghost">
                  Réinitialiser
                </button>
              }
            />
          ) : null}
        </div>
      </section>

      <MobileFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onReset={() => { void resetFilters(); }}
        activeCount={activeFilterCount}
        resultCount={filteredSessions.length}
        title="Filtrer le planning"
      >
        <FilterField label="Groupe">
          <select value={groupId} onChange={(event) => { void onGroupChange(event.target.value); }} className="field">
            <option value="">Tous les groupes</option>
            {groupsOptions.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </FilterField>
        <FilterField label="Jour">
          <select value={dayFilter} onChange={(event) => setDayFilter(event.target.value)} className="field">
            <option value="ALL">Tous les jours</option>
            <option value="1">Lundi</option><option value="2">Mardi</option><option value="3">Mercredi</option>
            <option value="4">Jeudi</option><option value="5">Vendredi</option><option value="6">Samedi</option><option value="0">Dimanche</option>
          </select>
        </FilterField>
        <FilterField label="Statut">
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "ALL" | SessionStatusDto)} className="field">
            <option value="ALL">Tous les statuts</option>
            <option value="PLANNED">Planifiées</option><option value="RESCHEDULED">Reportées</option>
            <option value="CANCELLED">Annulées</option><option value="COMPLETED">Terminées</option>
          </select>
        </FilterField>
      </MobileFilterSheet>

      {editingSession ? (
        <div className="mobile-modal-overlay fixed inset-0 z-50 flex justify-center bg-black/40">
          <div className="mobile-modal-panel border border-[var(--border)] bg-[var(--card)] p-5 shadow-[var(--shadow-floating)] md:max-w-2xl md:rounded-lg">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Modifier la séance
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              {editingSession.groupName} — {new Date(editingSession.sessionDate).toLocaleDateString("fr-FR")}
            </p>

            {editingHasAttendances ? (
              <p className="mt-3 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-3 py-2 text-sm text-[var(--foreground)]">
                Cette séance a {editingSession.attendanceCount} pointage(s). Annulez les présences depuis le pointage du
                jour avant de modifier ou reporter.
              </p>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Jour</label>
                <input
                  type="date"
                  value={editForm.sessionDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, sessionDate: e.target.value }))}
                  disabled={editingHasAttendances}
                  className="field text-sm"
                />
                {editMode === "permanent" ? (
                  <p className="mt-1 text-[0.65rem] text-[var(--muted-foreground)]">
                    Le jour et l&apos;heure choisis s&apos;appliquent à cette séance et à chaque semaine suivante (même jour de la semaine).
                  </p>
                ) : (
                  <p className="mt-1 text-[0.65rem] text-[var(--muted-foreground)]">
                    Exception : tous les champs ne modifient que cette séance.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Coach de cette séance</label>
                <select
                  value={editForm.coachId}
                  onChange={(e) => setEditForm((f) => ({ ...f, coachId: e.target.value }))}
                  disabled={editingHasAttendances}
                  className="field text-sm"
                >
                  <option value="">Aucun</option>
                  {coachesOptions.map((coach) => (
                    <option key={coach.id} value={coach.id}>{coachOptionLabel(coach)}</option>
                  ))}
                </select>
                {needsCoachSportOverride ? (
                  <p className="mt-1 text-xs text-[var(--danger)]">
                    Coach hors qualification pour le sport du groupe. Motif admin obligatoire.
                  </p>
                ) : null}
                <p className="mt-1 text-[0.65rem] text-[var(--muted-foreground)]">
                  Exception = cette séance seule. Permanent = ce créneau et les semaines suivantes.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Salle</label>
                <input
                  value={editForm.room}
                  onChange={(e) => setEditForm((f) => ({ ...f, room: e.target.value }))}
                  disabled={editingHasAttendances}
                  className="field text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Début</label>
                <input
                  type="time"
                  value={editForm.startTime}
                  onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))}
                  disabled={editingHasAttendances}
                  className="field text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Fin</label>
                <input
                  type="time"
                  value={editForm.endTime}
                  onChange={(e) => setEditForm((f) => ({ ...f, endTime: e.target.value }))}
                  disabled={editingHasAttendances}
                  className="field text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Statut</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as SessionStatusDto }))}
                  disabled={editingHasAttendances}
                  className="field text-sm"
                >
                  <option value="PLANNED">Planifiée</option>
                  <option value="RESCHEDULED">Reportée</option>
                  <option value="CANCELLED">Annulée</option>
                  {editingSession.status === "COMPLETED" ? (
                    <option value="COMPLETED">Terminée</option>
                  ) : null}
                </select>
                <p className="mt-1 text-[0.65rem] text-[var(--muted-foreground)]">
                  Une séance terminée se finalise depuis son écran de pointage.
                </p>
              </div>
              {editForm.status === "CANCELLED" ? (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Motif d&apos;annulation *</label>
                  <input
                    value={editForm.exceptionReason}
                    onChange={(e) => setEditForm((f) => ({ ...f, exceptionReason: e.target.value }))}
                    placeholder="Ex: férié, coach indisponible..."
                    disabled={editingHasAttendances}
                    className="field text-sm"
                    required={editForm.status === "CANCELLED"}
                  />
                </div>
              ) : null}
              {needsCoachSportOverride ? (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
                    Motif admin d&apos;exception
                  </label>
                  <textarea
                    value={editForm.coachSportOverrideReason}
                    onChange={(e) => setEditForm((f) => ({ ...f, coachSportOverrideReason: e.target.value }))}
                    maxLength={500}
                    disabled={editingHasAttendances}
                    className="field min-h-20 text-sm"
                    required
                  />
                </div>
              ) : null}
            </div>

            <FeedbackMessage message={editMessage} className="mt-3" />

            <div className="mt-5 border-t border-[var(--border)] pt-4">
              <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">Type de modification</p>
              <div className="mb-4 grid gap-2 sm:flex sm:gap-2">
                <button
                  type="button"
                  onClick={() => setEditMode("exception")}
                  disabled={editingHasAttendances}
                  className={`rounded-lg border px-3 py-2.5 text-sm transition-colors sm:flex-1 disabled:opacity-50 ${
                    editMode === "exception"
                      ? "border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)]"
                  }`}
                >
                  <span className="block font-medium">Exception</span>
                  <span className="text-xs">Cette séance uniquement</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode("permanent")}
                  disabled={editingHasAttendances}
                  className={`rounded-lg border px-3 py-2.5 text-sm transition-colors sm:flex-1 disabled:opacity-50 ${
                    editMode === "permanent"
                      ? "border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--surface-soft)]"
                  }`}
                >
                  <span className="block font-medium">Permanent</span>
                  <span className="text-xs">Toutes les prochaines semaines</span>
                </button>
              </div>

              {editMode === "permanent" ? (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-amber-800">
                    Motif de modification permanente *
                  </label>
                  <textarea
                    value={editForm.changeReason}
                    onChange={(e) => setEditForm((f) => ({ ...f, changeReason: e.target.value }))}
                    maxLength={500}
                    disabled={editingHasAttendances}
                    className="field min-h-20 bg-white text-sm text-[var(--foreground)]"
                    placeholder="Ex: changement de saison, salle remplacée, nouveau créneau validé..."
                    required
                  />
                  <p className="mt-1 text-xs leading-relaxed">
                    Ce motif sera conservé dans le journal car la modification touche cette séance et les semaines
                    suivantes.
                  </p>
                </div>
              ) : null}

              <div className="form-actions border-t-0 pt-0">
                <button type="button" onClick={closeEdit} className="btn btn-ghost btn-block-mobile">Annuler</button>
                <button
                  type="button"
                  onClick={() => { void saveEdit(); }}
                  disabled={
                    editLoading ||
                    editingHasAttendances ||
                    (editMode === "permanent" && editForm.changeReason.trim().length < 3) ||
                    (editForm.status === "CANCELLED" && !editForm.exceptionReason.trim()) ||
                    (needsCoachSportOverride && !editForm.coachSportOverrideReason.trim())
                  }
                  className="btn btn-primary btn-block-mobile"
                >
                  {editLoading ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={pendingDeleteSession !== null}
        title="Annuler cette séance ?"
        description={
          pendingDeleteSession
            ? `${pendingDeleteSession.groupName}, le ${formatDateFr(pendingDeleteSession.sessionDate)}. La séance restera dans l'historique avec le statut annulé.`
            : ""
        }
        confirmLabel="Annuler la séance"
        loading={loading}
        onCancel={() => setPendingDeleteSession(null)}
        onConfirm={() => pendingDeleteSession ? deleteSession(pendingDeleteSession.id) : undefined}
      />
    </div>
  );
}
