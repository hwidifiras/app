"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackMessage } from "@/components/ui/feedback-message";

type DayOfWeekValue =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

const dayOrder: DayOfWeekValue[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

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

type DaySelection = {
  day: DayOfWeekValue;
  checked: boolean;
  startTime: string;
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
  const [daySelections, setDaySelections] = useState<DaySelection[]>(
    dayOrder.map((day) => ({
      day,
      checked: false,
      startTime: "18:00",
    }))
  );
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function toggleDay(day: DayOfWeekValue) {
    setDaySelections((prev) =>
      prev.map((d) => (d.day === day ? { ...d, checked: !d.checked } : d))
    );
  }

  function updateDayTime(day: DayOfWeekValue, time: string) {
    setDaySelections((prev) =>
      prev.map((d) => (d.day === day ? { ...d, startTime: time } : d))
    );
  }

  async function onAddSchedules(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const selected = daySelections.filter((d) => d.checked);
    if (selected.length === 0) {
      setMessage("Veuillez sélectionner au moins un jour");
      setLoading(false);
      return;
    }

    const body = {
      schedules: selected.map((s) => ({
        dayOfWeek: s.day,
        startTime: s.startTime,
        durationMinutes,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom).toISOString() : undefined,
        effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : undefined,
      })),
      autoGenerate: true,
      horizonDays: 90,
    };

    const response = await fetch(`/api/groups/${groupId}/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de l'ajout des créneaux");
      setLoading(false);
      return;
    }

    setSchedules((current) => [...current, ...result.data]);
    setMessage(
      `${result.data?.length ?? 0} créneau(x) ajouté(s) — ${result.sessions?.createdCount ?? 0} séance(s) générée(s)`
    );
    setLoading(false);
    setDaySelections(dayOrder.map((day) => ({ day, checked: false, startTime: "18:00" })));
    setDurationMinutes(90);
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

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Créneaux hebdomadaires</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            {schedules.length} jour(s) programmé(s)
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
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
                  <td className="px-3 py-2 hidden sm:table-cell text-[var(--muted-foreground)]">{new Date(row.effectiveFrom).toLocaleDateString("fr-FR")}</td>
                  <td className="px-3 py-2 hidden sm:table-cell text-[var(--muted-foreground)]">{row.effectiveTo ? new Date(row.effectiveTo).toLocaleDateString("fr-FR") : "—"}</td>
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
                  <td colSpan={6} className="px-3 py-5 text-center text-[var(--muted-foreground)]">
                    Aucun créneau défini. Sélectionnez les jours ci-dessous.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] p-6">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Définir les créneaux hebdomadaires</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Cochez les jours d&apos;entraînement et définissez l&apos;heure pour chacun. Les séances seront automatiquement générées.
        </p>

        <form onSubmit={onAddSchedules} className="mt-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {daySelections.map((selection) => (
              <label
                key={selection.day}
                className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                  selection.checked
                    ? "border-[var(--primary)] bg-[var(--primary)]/5"
                    : "border-[var(--border)] hover:bg-[var(--surface-soft)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selection.checked}
                  onChange={() => toggleDay(selection.day)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                <span className="text-sm font-medium text-[var(--foreground)] flex-1">
                  {dayLabels[selection.day]}
                </span>
                {selection.checked && (
                  <input
                    type="time"
                    value={selection.startTime}
                    onChange={(e) => updateDayTime(selection.day, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="field text-sm w-[100px]"
                    required={selection.checked}
                  />
                )}
              </label>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Durée par séance (min)</label>
              <input
                type="number"
                min={30}
                max={240}
                step={5}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="field text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Valide du</label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="field text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Valide jusqu&apos;au (optionnel)</label>
              <input
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                className="field text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "Enregistrement..." : "Enregistrer et générer les séances"}
            </button>
          </div>
        </form>

        <FeedbackMessage message={message} className="mt-3" />
      </div>
    </div>
  );
}
