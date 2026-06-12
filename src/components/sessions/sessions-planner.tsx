"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

import { SessionDto, SessionStatusDto } from "@/types/session";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { UndoButton } from "@/components/ui/undo-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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

type SessionsPlannerProps = {
  initialSessions: SessionDto[];
  initialWeekStart: string;
  initialGroupId?: string;
  initialSessionId?: string;
  groupsOptions: Array<{ id: string; name: string }>;
  coachesOptions: Array<{ id: string; firstName: string; lastName: string }>;
};

const sessionStatusLabels: Record<SessionStatusDto, string> = {
  PLANNED: "Planifiée",
  RESCHEDULED: "Reportée",
  CANCELLED: "Annulée",
  COMPLETED: "Terminée",
};

function formatDateFr(dateIso: string) {
  return new Date(dateIso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function SessionsPlanner({
  initialSessions,
  initialWeekStart,
  initialGroupId = "",
  initialSessionId = "",
  groupsOptions,
  coachesOptions,
}: SessionsPlannerProps) {
  const [sessions, setSessions] = useState<SessionDto[]>(initialSessions);
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [groupId, setGroupId] = useState(initialGroupId);
  const [dayFilter, setDayFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | SessionStatusDto>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDeleteSession, setPendingDeleteSession] = useState<SessionDto | null>(null);

  const [editingSession, setEditingSession] = useState<SessionDto | null>(null);
  const [editForm, setEditForm] = useState({
    sessionDate: "",
    coachId: "",
    room: "",
    startTime: "",
    endTime: "",
    status: "" as SessionStatusDto | "",
    exceptionReason: "",
  });
  const [editMode, setEditMode] = useState<"exception" | "permanent" | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  const deepLinkHandled = useRef(false);
  const { push, undoLast, loading: undoLoading, canUndo } = useActionHistory({ enableKeyboard: true });

  const weekEnd = useMemo(() => weekEndIsoFromStartIso(weekStart), [weekStart]);
  const editingHasAttendances = (editingSession?.attendanceCount ?? 0) > 0;

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
    await reloadSessions(weekStart, nextGroupId);
  }

  function openEdit(session: SessionDto) {
    setEditingSession(session);
    setEditForm({
      sessionDate: formatUtcDateOnlyIso(new Date(session.sessionDate)),
      coachId: session.coachId ?? "",
      room: session.room,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      exceptionReason: session.exceptionReason ?? "",
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

    if (!response.ok) {
      const result = await parseApiResponse<{ error?: string }>(response);
      setMessage(result.error ?? "Erreur lors de la suppression");
      setLoading(false);
      return;
    }

    setSessions((current) => current.filter((s) => s.id !== sessionId));
    setPendingDeleteSession(null);
    setMessage("Séance supprimée avec succès");
    setLoading(false);
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

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, SessionDto[]>();

    for (const item of filteredSessions) {
      const key = formatUtcDateOnlyIso(new Date(item.sessionDate));
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    }

    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
  }, [filteredSessions]);

  const activeFilterCount = [
    Boolean(groupId),
    dayFilter !== "ALL",
    statusFilter !== "ALL",
  ].filter(Boolean).length;

  async function resetFilters() {
    setDayFilter("ALL");
    setStatusFilter("ALL");
    if (groupId) {
      await onGroupChange("");
    }
  }

  return (
    <div>
      <section className="panel p-3 sm:p-5">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Vue semaine filtrable</h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              Semaine du {formatDateFr(`${weekStart}T12:00:00.000Z`)} au {formatDateFr(`${weekEnd}T12:00:00.000Z`)}
            </p>
          </div>

          <div className="grid grid-cols-[auto_1fr_auto] gap-2 sm:flex sm:w-auto">
            <button type="button" onClick={() => { void goToWeek(-1); }} className="btn btn-ghost px-3" aria-label="Semaine précédente">
              <ChevronLeft className="size-4" />
            </button>
            <button type="button" onClick={() => { void resetCurrentWeek(); }} className="btn btn-ghost">
              Semaine actuelle
            </button>
            <button type="button" onClick={() => { void goToWeek(1); }} className="btn btn-ghost px-3" aria-label="Semaine suivante">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div className="sticky top-[57px] z-20 -mx-2 mt-3 border-b border-[var(--border)] bg-[var(--surface)]/96 px-2 pb-3 pt-1 backdrop-blur lg:top-[3.5rem]">
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

        <div className="mt-5 space-y-4">
          {sessionsByDay.map(([dayKey, daySessions]) => (
            <section key={dayKey} className="rounded-xl border border-[var(--border)] p-4">
              <h3 className="text-sm font-semibold capitalize text-[var(--foreground)]">{formatDateFr(`${dayKey}T00:00:00`)}</h3>

              <ul className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {daySessions.map((item) => (
                  <li key={item.id} className="rounded-lg border border-[var(--border)] p-3">
                    <div className="flex h-full flex-col gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--foreground)]">{item.groupName}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">{item.startTime} - {item.endTime} • Salle {item.room}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">Coach: {item.coachName ?? "-"}</p>
                        {item.exceptionReason ? (
                          <p className="text-xs text-[var(--danger)]">Motif: {item.exceptionReason}</p>
                        ) : null}
                      </div>
                      <div className="mt-auto flex w-full items-center justify-between gap-2">
                        <StatusBadge variant={item.status === "CANCELLED" ? "danger" : item.status === "COMPLETED" ? "success" : item.status === "RESCHEDULED" ? "warning" : "info"}>
                          {sessionStatusLabels[item.status]}
                        </StatusBadge>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="btn btn-ghost btn-sm"
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteSession(item)}
                            disabled={(item.attendanceCount ?? 0) > 0}
                            title={
                              (item.attendanceCount ?? 0) > 0
                                ? "Annulez les pointages depuis le pointage du jour avant de supprimer"
                                : undefined
                            }
                            className="btn btn-ghost btn-sm border-[var(--danger)]/30 text-[var(--danger)] disabled:opacity-50"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}

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

      {/* Modal d'édition de séance */}
      {editingSession ? (
        <div className="mobile-modal-overlay fixed inset-0 z-50 flex justify-center bg-black/40">
          <div className="mobile-modal-panel border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl md:max-w-lg md:rounded-xl">
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
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Coach</label>
                <select
                  value={editForm.coachId}
                  onChange={(e) => setEditForm((f) => ({ ...f, coachId: e.target.value }))}
                  disabled={editingHasAttendances}
                  className="field text-sm"
                >
                  <option value="">Aucun</option>
                  {coachesOptions.map((coach) => (
                    <option key={coach.id} value={coach.id}>{coach.firstName} {coach.lastName}</option>
                  ))}
                </select>
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
                  <option value="COMPLETED">Terminée</option>
                </select>
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

              <div className="form-actions border-t-0 pt-0">
                <button type="button" onClick={closeEdit} className="btn btn-ghost btn-block-mobile">Annuler</button>
                <button
                  type="button"
                  onClick={() => { void saveEdit(); }}
                  disabled={
                    editLoading ||
                    editingHasAttendances ||
                    (editForm.status === "CANCELLED" && !editForm.exceptionReason.trim())
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
        title="Supprimer cette séance ?"
        description={
          pendingDeleteSession
            ? `${pendingDeleteSession.groupName}, le ${formatDateFr(pendingDeleteSession.sessionDate)}. Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer la séance"
        loading={loading}
        onCancel={() => setPendingDeleteSession(null)}
        onConfirm={() => pendingDeleteSession ? deleteSession(pendingDeleteSession.id) : undefined}
      />
    </div>
  );
}
