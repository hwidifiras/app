"use client";

import { FormEvent, useState } from "react";
import { ChevronDown } from "lucide-react";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormActions, FormSectionNav } from "@/components/ui/form-layout";

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
  const [expandedScheduleIds, setExpandedScheduleIds] = useState<string[]>([]);
  const [pendingDeleteSchedule, setPendingDeleteSchedule] = useState<ScheduleRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function toggleExpand(scheduleId: string) {
    setExpandedScheduleIds((current) =>
      current.includes(scheduleId) ? current.filter((id) => id !== scheduleId) : [...current, scheduleId],
    );
  }

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
    setDeletingId(scheduleId);
    setMessage(null);
    const response = await fetch(`/api/groups/${groupId}/schedules`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleId }),
    });

    if (!response.ok) {
      const result = await response.json();
      setMessage(result.error ?? "Erreur lors de la suppression");
      setDeletingId(null);
      return;
    }

    setSchedules((current) => current.filter((s) => s.id !== scheduleId));
    setPendingDeleteSchedule(null);
    setMessage("Créneau supprimé");
    setDeletingId(null);
  }

  return (
    <div className="space-y-6">
      <FormSectionNav
        items={[
          { href: "#schedule-current", label: "Créneaux" },
          { href: "#schedule-new", label: "Ajouter" },
        ]}
      />

      <div id="schedule-current" className="form-section-anchor rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)] sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Créneaux hebdomadaires</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            {schedules.length} jour(s) programmé(s)
          </p>
        </div>

        <div className="data-table overflow-x-auto rounded-lg border border-[var(--border)] shadow-[var(--shadow-panel)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Jour</th>
                <th className="px-3 py-2 text-left font-semibold">Heure</th>
                <th className="px-3 py-2 text-left font-semibold hidden md:table-cell">Durée</th>
                <th className="px-3 py-2 text-left font-semibold hidden md:table-cell">Valide du</th>
                <th className="px-3 py-2 text-left font-semibold hidden md:table-cell">Valide jusqu&apos;au</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {schedules.map((row) => {
                const expanded = expandedScheduleIds.includes(row.id);
                return (
                  <tr
                    key={row.id}
                    className={`mobile-collapsible-row hover:bg-[var(--surface-soft)] transition-colors ${expanded ? "is-expanded" : ""}`}
                  >
                    <td className="data-table-primary px-3 py-2 font-medium text-[var(--foreground)]" data-label="Jour">
                      {dayLabels[row.dayOfWeek as DayOfWeekValue] ?? row.dayOfWeek}
                    </td>
                    <td className="px-3 py-2" data-label="Heure">{row.startTime}</td>
                    <td className="px-3 py-2 mobile-detail-cell" data-label="Durée">
                      {row.durationMinutes} min
                    </td>
                    <td className="px-3 py-2 mobile-detail-cell text-[var(--muted-foreground)]" data-label="Valide du">
                      {new Date(row.effectiveFrom).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-3 py-2 mobile-detail-cell text-[var(--muted-foreground)]" data-label="Valide jusqu'au">
                      {row.effectiveTo ? new Date(row.effectiveTo).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td className="card-actions-cell px-3 py-2 text-right" data-label="Actions">
                      <div className="card-actions-stack">
                        <button
                          type="button"
                          onClick={() => setPendingDeleteSchedule(row)}
                          disabled={deletingId !== null}
                          className="btn btn-danger md:min-h-0 md:px-2 md:py-1 md:text-xs"
                        >
                          Supprimer
                        </button>
                      </div>
                      <button
                        type="button"
                        className="mobile-card-toggle md:hidden"
                        onClick={() => toggleExpand(row.id)}
                        aria-expanded={expanded}
                      >
                        {expanded ? "Réduire" : "Infos"}
                        <ChevronDown className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                      </button>
                    </td>
                  </tr>
                );
              })}
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

      <div id="schedule-new" className="form-section-anchor rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)] sm:p-6">
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

          <FormActions sticky>
            <button type="submit" disabled={loading} className="btn btn-primary btn-block-mobile">
              {loading ? "Enregistrement…" : "Enregistrer et générer les séances"}
            </button>
          </FormActions>
        </form>

        <FeedbackMessage message={message} className="mt-3" />
      </div>

      <ConfirmDialog
        open={pendingDeleteSchedule !== null}
        title="Supprimer ce créneau ?"
        description={
          pendingDeleteSchedule
            ? `${dayLabels[pendingDeleteSchedule.dayOfWeek as DayOfWeekValue] ?? pendingDeleteSchedule.dayOfWeek} à ${pendingDeleteSchedule.startTime}. Les séances déjà générées ne seront pas automatiquement recréées.`
            : ""
        }
        confirmLabel="Supprimer le créneau"
        loading={deletingId === pendingDeleteSchedule?.id}
        onCancel={() => setPendingDeleteSchedule(null)}
        onConfirm={() => pendingDeleteSchedule ? onDeleteSchedule(pendingDeleteSchedule.id) : undefined}
      />
    </div>
  );
}
