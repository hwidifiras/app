"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

import { SessionDto, SessionStatusDto } from "@/types/session";
import { EmptyState } from "@/components/ui/empty-state";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { UndoButton } from "@/components/ui/undo-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  SessionDetailPanel,
  SessionTile,
} from "@/components/sessions/session-planner-ui";
import {
  PlanningCommandHeader,
  PlanningSummaryStrip,
  PlanningViewSwitcher,
} from "@/components/sessions/session-planner-command";
import {
  filterPlannerSessions,
  formatDateFr,
  getGroupedPlanningSections,
  getPlanningWeekSummary,
  getRecommendedPlannerSession,
  sessionDateKey,
  type PlanningViewMode,
} from "@/components/sessions/session-planner-derived-model";
import {
  SessionGenerationPanel,
  type SessionGenerationPreview,
} from "@/components/sessions/session-generation-panel";
import { PlanningWeekBoard } from "@/components/sessions/session-planner-board";
import {
  PlanningFiltersToolbar,
  PlanningMobileFilterSheet,
} from "@/components/sessions/session-planner-filters";
import { PlanningGroupedSections } from "@/components/sessions/session-planner-grouped-sections";
import { SessionEditModal, type SessionEditFormState } from "@/components/sessions/session-edit-modal";
import {
  getActivePlannerMobileDay,
  getClosedPlannerWeekDaysWithSessions,
  getHiddenClosedPlannerWeekDays,
  getPlannerDayStatsByDate,
  getPlannerWeekDays,
  getPlannerWorkingDaySet,
  getSessionDateKeys,
  getVisiblePlannerWeekDays,
  groupPlannerSessionsByDate,
} from "@/components/sessions/session-planner-week-model";
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
import type { ClubDay } from "@/lib/club-working-days";
import { isCoachQualifiedForSport } from "@/lib/coach-display";

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
  const [editForm, setEditForm] = useState<SessionEditFormState>({
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
      !isCoachQualifiedForSport(selectedEditCoach, editingSession.groupSportId),
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
    return filterPlannerSessions({
      sessions,
      dayFilter,
      statusFilter,
      searchTerm,
    });
  }, [dayFilter, searchTerm, sessions, statusFilter]);

  const weekDays = useMemo(() => getPlannerWeekDays(weekStart), [weekStart]);
  const workingDaySet = useMemo(
    () => getPlannerWorkingDaySet(planningPreferences.workingDays),
    [planningPreferences.workingDays],
  );
  const filteredSessionDateKeys = useMemo(
    () => getSessionDateKeys(filteredSessions),
    [filteredSessions],
  );
  const visibleWeekDays = useMemo(
    () =>
      getVisiblePlannerWeekDays({
        weekDays,
        dayFilter,
        workingDaySet,
        sessionDateKeys: filteredSessionDateKeys,
      }),
    [dayFilter, filteredSessionDateKeys, weekDays, workingDaySet],
  );
  const hiddenClosedDays = useMemo(
    () =>
      getHiddenClosedPlannerWeekDays({
        weekDays,
        workingDaySet,
        sessionDateKeys: filteredSessionDateKeys,
      }),
    [filteredSessionDateKeys, weekDays, workingDaySet],
  );
  const closedDaysWithSessions = useMemo(
    () =>
      getClosedPlannerWeekDaysWithSessions({
        visibleWeekDays,
        workingDaySet,
        sessionDateKeys: filteredSessionDateKeys,
      }),
    [filteredSessionDateKeys, visibleWeekDays, workingDaySet],
  );
  const sessionsByDate = useMemo(
    () => groupPlannerSessionsByDate({ visibleWeekDays, sessions: filteredSessions }),
    [filteredSessions, visibleWeekDays],
  );

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
    return getPlanningWeekSummary({
      sessions: filteredSessions,
      conflictSessionIds,
    });
  }, [conflictSessionIds, filteredSessions]);

  const dayStatsByDate = useMemo(
    () => getPlannerDayStatsByDate({ visibleWeekDays, sessionsByDate, conflictSessionIds }),
    [conflictSessionIds, sessionsByDate, visibleWeekDays],
  );

  const activeMobileDay = useMemo(() => {
    return getActivePlannerMobileDay({ selectedMobileDay, visibleWeekDays, sessionsByDate });
  }, [selectedMobileDay, sessionsByDate, visibleWeekDays]);

  const firstConflictSession = useMemo(
    () => filteredSessions.find((session) => conflictSessionIds.has(session.id)) ?? null,
    [conflictSessionIds, filteredSessions],
  );

  const recommendedSession = useMemo(() => {
    return getRecommendedPlannerSession({
      sessions: filteredSessions,
      conflictSessionIds,
    });
  }, [conflictSessionIds, filteredSessions]);

  const selectedSession = useMemo(() => {
    return filteredSessions.find((session) => session.id === expandedSessionId) ?? recommendedSession;
  }, [expandedSessionId, filteredSessions, recommendedSession]);

  const groupedPlanningSections = useMemo(() => {
    return getGroupedPlanningSections({
      viewMode,
      visibleWeekDays,
      sessionsByDate,
      dayStatsByDate,
      sessions: filteredSessions,
    });
  }, [dayStatsByDate, filteredSessions, sessionsByDate, viewMode, visibleWeekDays]);

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
        <PlanningCommandHeader
          weekStart={weekStart}
          weekEnd={weekEnd}
          generating={generating}
          loading={loading}
          onPreviousWeek={() => { void goToWeek(-1); }}
          onCurrentWeek={() => { void resetCurrentWeek(); }}
          onNextWeek={() => { void goToWeek(1); }}
          onPreviewGeneration={() => { void previewSessionsGeneration(); }}
        />

        {generationPreview ? (
          <SessionGenerationPanel
            preview={generationPreview}
            targetLabel={generationTargetLabel}
            generating={generating}
            onCancel={() => setGenerationPreview(null)}
            onGenerate={() => { void generateSessions(); }}
          />
        ) : null}

        <PlanningSummaryStrip summary={weekSummary} onFocusFirstConflict={focusFirstConflict} />
        <PlanningViewSwitcher viewMode={viewMode} onViewModeChange={setViewMode} />

        <PlanningFiltersToolbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          groupId={groupId}
          groupsOptions={groupsOptions}
          onGroupChange={(nextGroupId) => { void onGroupChange(nextGroupId); }}
          dayFilter={dayFilter}
          onDayFilterChange={setDayFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          activeFilterCount={activeFilterCount}
          resultCount={filteredSessions.length}
          hiddenClosedDaysCount={hiddenClosedDays.length}
          closedDaysWithSessionsCount={closedDaysWithSessions.length}
          onOpenMobileFilters={() => setFiltersOpen(true)}
          onResetFilters={() => { void resetFilters(); }}
        />

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
                <PlanningWeekBoard
                  days={visibleWeekDays}
                  sessionsByDate={sessionsByDate}
                  dayStatsByDate={dayStatsByDate}
                  activeMobileDay={activeMobileDay}
                  onSelectMobileDay={setSelectedMobileDay}
                  renderSessionTile={renderSessionTile}
                />
              ) : (
                <PlanningGroupedSections
                  sections={groupedPlanningSections}
                  conflictSessionIds={conflictSessionIds}
                  renderSessionTile={renderSessionTile}
                />
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
      </section>

      <PlanningMobileFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onReset={() => { void resetFilters(); }}
        activeFilterCount={activeFilterCount}
        resultCount={filteredSessions.length}
        groupId={groupId}
        groupsOptions={groupsOptions}
        onGroupChange={(nextGroupId) => { void onGroupChange(nextGroupId); }}
        dayFilter={dayFilter}
        onDayFilterChange={setDayFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {editingSession ? (
        <SessionEditModal
          session={editingSession}
          editForm={editForm}
          editMode={editMode}
          editMessage={editMessage}
          editLoading={editLoading}
          editingHasAttendances={editingHasAttendances}
          needsCoachSportOverride={needsCoachSportOverride}
          coachesOptions={coachesOptions}
          onFormChange={(patch) => setEditForm((form) => ({ ...form, ...patch }))}
          onEditModeChange={setEditMode}
          onClose={closeEdit}
          onSave={() => { void saveEdit(); }}
        />
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
