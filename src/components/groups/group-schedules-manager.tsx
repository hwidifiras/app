"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type DayOfWeekValue =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

const dayLabels: Record<DayOfWeekValue, string> = {
  MONDAY: "Lundi",
  TUESDAY: "Mardi",
  WEDNESDAY: "Mercredi",
  THURSDAY: "Jeudi",
  FRIDAY: "Vendredi",
  SATURDAY: "Samedi",
  SUNDAY: "Dimanche",
};

type ScheduleRow = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  durationMinutes: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
};

export function GroupSchedulesManager({
  groupId,
  initialSchedules,
}: {
  groupId: string;
  initialSchedules: ScheduleRow[];
}) {
  const router = useRouter();
  const [schedules, setSchedules] = useState<ScheduleRow[]>(initialSchedules);
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeekValue>("MONDAY");
  const [startTime, setStartTime] = useState("18:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [genMessage, setGenMessage] = useState<string | null>(null);

  async function onAddSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const body: Record<string, unknown> = {
      dayOfWeek,
      startTime,
      durationMinutes,
    };

    if (effectiveFrom) body.effectiveFrom = new Date(effectiveFrom).toISOString();
    if (effectiveTo) body.effectiveTo = new Date(effectiveTo).toISOString();

    const response = await fetch(`/api/groups/${groupId}/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de l'ajout du créneau");
      setLoading(false);
      return;
    }

    setSchedules((current) => [...current, result.data]);
    setMessage("Créneau ajouté avec succès");
    setLoading(false);
    setStartTime("18:00");
    setDurationMinutes(60);
    setEffectiveFrom("");
    setEffectiveTo("");
  }

  async function onDeleteSchedule(scheduleId: string) {
    const confirmed = window.confirm("Confirmer la suppression de ce créneau ?");
    if (!confirmed) return;

    const response = await fetch(`/api/groups/${groupId}/schedules`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleId }),
    });

    if (!response.ok) {
      const result = await response.json();
      setMessage(result.error ?? "Erreur lors de la suppression");
      return;
    }

    setSchedules((current) => current.filter((s) => s.id !== scheduleId));
    setMessage("Créneau supprimé");
  }

  async function onGenerateSessions() {
    setGenLoading(true);
    setGenMessage(null);

    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, horizonDays: 56 }),
    });

    const result = await response.json();

    if (!response.ok) {
      setGenMessage(result.error ?? "Erreur lors de la génération");
      setGenLoading(false);
      return;
    }

    setGenMessage(
      `${result.data?.createdCount ?? 0} séance(s) créée(s) / ${result.data?.candidatesCount ?? 0} prévue(s) — ${result.data?.skippedCount ?? 0} existante(s)`
    );
    setGenLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Créneaux hebdomadaires</h2>
          <button
            type="button"
            onClick={() => { void onGenerateSessions(); }}
            disabled={genLoading || schedules.length === 0}
            className="btn btn-primary"
          >
            {genLoading ? "Génération..." : "Générer séances J+56"}
          </button>
        </div>

        {genMessage ? (
          <p className={"mb-3 text-sm " + (genMessage.includes("créée") ? "text-[var(--success)]" : "text-[var(--danger)]")}>
            {genMessage}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted)]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Jour</th>
                <th className="px-3 py-2 text-left font-semibold">Heure</th>
                <th className="px-3 py-2 text-left font-semibold">Durée</th>
                <th className="px-3 py-2 text-left font-semibold hidden sm:table-cell">Valide du</th>
                <th className="px-3 py-2 text-left font-semibold hidden sm:table-cell">Valide jusqu&apos;au</th>
                <th className="px-3 py-2 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {schedules.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--surface-soft)] transition-colors">
                  <td className="px-3 py-2 font-medium text-[var(--foreground)]">{dayLabels[row.dayOfWeek as DayOfWeekValue] ?? row.dayOfWeek}</td>
                  <td className="px-3 py-2">{row.startTime}</td>
                  <td className="px-3 py-2">{row.durationMinutes} min</td>
                  <td className="px-3 py-2 hidden sm:table-cell text-[var(--muted)]">{new Date(row.effectiveFrom).toLocaleDateString("fr-FR")}</td>
                  <td className="px-3 py-2 hidden sm:table-cell text-[var(--muted)]">{row.effectiveTo ? new Date(row.effectiveTo).toLocaleDateString("fr-FR") : "—"}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => { void onDeleteSchedule(row.id); }}
                      className="btn btn-danger text-xs px-2 py-1 min-h-0"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
              {schedules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-5 text-center text-[var(--muted)]">
                    Aucun créneau défini. Ajoutez un créneau ci-dessous.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Ajouter un créneau</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Définir un jour et une heure de répétition hebdomadaire pour ce groupe.
        </p>

        <form onSubmit={onAddSchedule} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">Jour</label>
            <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value as DayOfWeekValue)} className="field text-sm" required>
              {Object.entries(dayLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">Heure</label>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="field text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">Durée (min)</label>
            <input type="number" min={30} max={240} step={5} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} className="field text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">Valide du</label>
            <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} className="field text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">Valide jusqu&apos;au (optionnel)</label>
            <input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} className="field text-sm" />
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "Ajout..." : "Ajouter créneau"}
            </button>
          </div>
        </form>

        {message ? (
          <p className={"mt-3 text-sm " + (message.includes("succès") || message === "Créneau supprimé" ? "text-[var(--success)]" : "text-[var(--danger)]")}>
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
