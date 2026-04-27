"use client";

import { useMemo, useState } from "react";

import { SessionDto, SessionStatusDto } from "@/types/session";

type SessionsPlannerProps = {
  initialSessions: SessionDto[];
  initialWeekStart: string;
  groupsOptions: Array<{ id: string; name: string }>;
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

export function SessionsPlanner({ initialSessions, initialWeekStart, groupsOptions }: SessionsPlannerProps) {
  const [sessions, setSessions] = useState<SessionDto[]>(initialSessions);
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [groupId, setGroupId] = useState("");
  const [dayFilter, setDayFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | SessionStatusDto>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    <main className="app-shell py-4 md:py-8">
      <div className="mb-5 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Parcours réception</p>
        <h1 className="text-2xl font-semibold text-[var(--foreground)] md:text-3xl">Planning des séances (US-08)</h1>
      </div>

      <section className="panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Vue semaine filtrable</h2>
            <p className="text-sm text-[var(--muted)]">Semaine du {new Date(`${weekStart}T00:00:00`).toLocaleDateString("fr-FR")} au {new Date(`${weekEnd}T00:00:00`).toLocaleDateString("fr-FR")}</p>
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

        {loading ? <p className="mt-4 text-sm text-[var(--muted)]">Chargement du planning...</p> : null}
        {message ? <p className="mt-4 text-sm text-[var(--foreground)]">{message}</p> : null}

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
                        <p className="text-xs text-[var(--muted)]">{item.startTime} - {item.endTime} • Salle {item.room}</p>
                        <p className="text-xs text-[var(--muted)]">Coach: {item.coachName ?? "-"}</p>
                      </div>
                      <span className={`chip ${item.status === "CANCELLED" ? "chip-muted" : "chip-active"}`}>
                        {sessionStatusLabels[item.status]}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {sessionsByDay.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
              Aucune séance trouvée pour ces filtres.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
