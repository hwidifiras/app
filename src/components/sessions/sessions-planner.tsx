"use client";

import { useMemo, useState } from "react";

import { SessionDto, SessionStatusDto } from "@/types/session";
import { StatusBadge } from "@/components/ui/status-badge";
import { FeedbackMessage } from "@/components/ui/feedback-message";

type SessionsPlannerProps = {
  initialSessions: SessionDto[];
  initialWeekStart: string;
  groupsOptions: Array<{ id: string; name: string }>;
  coachesOptions: Array<{ id: string; firstName: string; lastName: string }>;
};

const sessionStatusLabels: Record<SessionStatusDto, string> = {
  PLANNED: "Planifiée",
  RESCHEDULED: "Reportée",
  CANCELLED: "Annulée",
  COMPLETED: "Terminée",
};

function startOfWeek(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const mondayDelta = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + mondayDelta);
  return copy;
}

function toDateOnlyIso(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, "0")}-${String(copy.getDate()).padStart(2, "0")}`;
}

function formatDateFr(dateIso: string) {
  return new Date(dateIso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function SessionsPlanner({ initialSessions, initialWeekStart, groupsOptions, coachesOptions }: SessionsPlannerProps) {
  const [sessions, setSessions] = useState<SessionDto[]>(initialSessions);
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [groupId, setGroupId] = useState("");
  const [dayFilter, setDayFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | SessionStatusDto>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [editingSession, setEditingSession] = useState<SessionDto | null>(null);
  const [editForm, setEditForm] = useState({
    coachId: "",
    room: "",
    startTime: "",
    endTime: "",
    status: "" as SessionStatusDto | "",
    exceptionReason: "",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editMessage, setEditMessage] = useState<string | null>(null);

  const weekEnd = useMemo(() => {
    const start = new Date(`${weekStart}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return toDateOnlyIso(end);
  }, [weekStart]);

  async function reloadSessions(nextWeekStart: string, nextGroupId: string) {
    setLoading(true);
    setMessage(null);

    const from = new Date(`${nextWeekStart}T00:00:00`);
    const to = new Date(from);
    to.setDate(to.getDate() + 6);

    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });

    if (nextGroupId) {
      params.set("groupId", nextGroupId);
    }

    const response = await fetch(`/api/sessions?${params.toString()}`, { cache: "no-store" });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors du chargement du planning");
      setLoading(false);
      return;
    }

    setSessions(result.data ?? []);
    setLoading(false);
  }

  async function goToWeek(offsetWeeks: number) {
    const start = new Date(`${weekStart}T00:00:00`);
    start.setDate(start.getDate() + offsetWeeks * 7);
    const nextWeekStart = toDateOnlyIso(startOfWeek(start));
    setWeekStart(nextWeekStart);
    await reloadSessions(nextWeekStart, groupId);
  }

  async function resetCurrentWeek() {
    const currentMonday = toDateOnlyIso(startOfWeek(new Date()));
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
      coachId: session.coachId ?? "",
      room: session.room,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      exceptionReason: session.exceptionReason ?? "",
    });
    setEditMessage(null);
  }

  function closeEdit() {
    setEditingSession(null);
    setEditLoading(false);
    setEditMessage(null);
  }

  async function saveEdit() {
    if (!editingSession) return;
    setEditLoading(true);
    setEditMessage(null);

    const body: Record<string, unknown> = {};
    if (editForm.coachId) body.coachId = editForm.coachId;
    if (editForm.room) body.room = editForm.room;
    if (editForm.startTime) body.startTime = editForm.startTime;
    if (editForm.endTime) body.endTime = editForm.endTime;
    if (editForm.status) body.status = editForm.status;
    if (editForm.exceptionReason) body.exceptionReason = editForm.exceptionReason;

    const response = await fetch(`/api/sessions/${editingSession.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      setEditMessage(result.error ?? "Erreur lors de la modification");
      setEditLoading(false);
      return;
    }

    setSessions((current) =>
      current.map((s) =>
        s.id === editingSession.id
          ? { ...s, ...result.data, sessionDate: s.sessionDate }
          : s
      )
    );
    setEditMessage("Séance modifiée avec succès");
    setEditLoading(false);
    setTimeout(() => closeEdit(), 600);
  }

  async function deleteSession(sessionId: string) {
    const confirmed = window.confirm("Confirmer la suppression de cette séance ?");
    if (!confirmed) return;

    setLoading(true);
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const result = await response.json();
      setMessage(result.error ?? "Erreur lors de la suppression");
      setLoading(false);
      return;
    }

    setSessions((current) => current.filter((s) => s.id !== sessionId));
    setMessage("Séance supprimée avec succès");
    setLoading(false);
  }

  const filteredSessions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return sessions.filter((item) => {
      const sessionDate = new Date(item.sessionDate);
      const day = String(sessionDate.getDay());

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
      const key = toDateOnlyIso(new Date(item.sessionDate));
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    }

    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
  }, [filteredSessions]);

  return (
    <div>
      <section className="panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Vue semaine filtrable</h2>
            <p className="text-sm text-[var(--muted-foreground)]">Semaine du {new Date(`${weekStart}T00:00:00`).toLocaleDateString("fr-FR")} au {new Date(`${weekEnd}T00:00:00`).toLocaleDateString("fr-FR")}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => { void goToWeek(-1); }} className="btn btn-ghost">Semaine -1</button>
            <button type="button" onClick={() => { void resetCurrentWeek(); }} className="btn btn-ghost">Semaine actuelle</button>
            <button type="button" onClick={() => { void goToWeek(1); }} className="btn btn-ghost">Semaine +1</button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <select
            value={groupId}
            onChange={(e) => {
              void onGroupChange(e.target.value);
            }}
            className="field"
          >
            <option value="">Tous les groupes</option>
            {groupsOptions.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>

          <select value={dayFilter} onChange={(e) => setDayFilter(e.target.value)} className="field">
            <option value="ALL">Tous les jours</option>
            <option value="1">Lundi</option>
            <option value="2">Mardi</option>
            <option value="3">Mercredi</option>
            <option value="4">Jeudi</option>
            <option value="5">Vendredi</option>
            <option value="6">Samedi</option>
            <option value="0">Dimanche</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | SessionStatusDto)}
            className="field"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="PLANNED">Planifiée</option>
            <option value="RESCHEDULED">Reportée</option>
            <option value="CANCELLED">Annulée</option>
            <option value="COMPLETED">Terminée</option>
          </select>

          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher groupe/coach/salle"
            className="field"
          />
        </div>

        {loading ? <p className="mt-4 text-sm text-[var(--muted-foreground)]">Chargement du planning...</p> : null}
        <FeedbackMessage message={message} className="mt-4" />

        <div className="mt-5 space-y-4">
          {sessionsByDay.map(([dayKey, daySessions]) => (
            <section key={dayKey} className="rounded-xl border border-[var(--border)] p-4">
              <h3 className="text-sm font-semibold capitalize text-[var(--foreground)]">{formatDateFr(`${dayKey}T00:00:00`)}</h3>

              <ul className="mt-3 space-y-2">
                {daySessions.map((item) => (
                  <li key={item.id} className="rounded-lg border border-[var(--border)] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[var(--foreground)]">{item.groupName}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">{item.startTime} - {item.endTime} • Salle {item.room}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">Coach: {item.coachName ?? "-"}</p>
                        {item.exceptionReason ? (
                          <p className="text-xs text-[var(--danger)]">Motif: {item.exceptionReason}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge variant={item.status === "CANCELLED" ? "danger" : item.status === "COMPLETED" ? "success" : item.status === "RESCHEDULED" ? "warning" : "info"}>
                          {sessionStatusLabels[item.status]}
                        </StatusBadge>
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="btn btn-ghost text-xs px-2 py-1 min-h-0"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => { void deleteSession(item.id); }}
                          className="btn btn-danger text-xs px-2 py-1 min-h-0"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {sessionsByDay.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted-foreground)]">
              Aucune séance trouvée pour ces filtres.
            </div>
          ) : null}
        </div>
      </section>

      {/* Modal d'édition de séance */}
      {editingSession ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-12">
          <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Modifier la séance
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] mt-1">
              {editingSession.groupName} — {new Date(editingSession.sessionDate).toLocaleDateString("fr-FR")}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Coach</label>
                <select
                  value={editForm.coachId}
                  onChange={(e) => setEditForm((f) => ({ ...f, coachId: e.target.value }))}
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
                  className="field text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Début</label>
                <input
                  type="time"
                  value={editForm.startTime}
                  onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="field text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Fin</label>
                <input
                  type="time"
                  value={editForm.endTime}
                  onChange={(e) => setEditForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="field text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Statut</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as SessionStatusDto }))}
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
                    className="field text-sm"
                    required={editForm.status === "CANCELLED"}
                  />
                </div>
              ) : null}
            </div>

            <FeedbackMessage message={editMessage} className="mt-3" />

            <div className="mt-5 flex items-center justify-end gap-2">
              <button type="button" onClick={closeEdit} className="btn btn-ghost">Annuler</button>
              <button
                type="button"
                onClick={() => { void saveEdit(); }}
                disabled={editLoading || (editForm.status === "CANCELLED" && !editForm.exceptionReason.trim())}
                className="btn btn-primary"
              >
                {editLoading ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
