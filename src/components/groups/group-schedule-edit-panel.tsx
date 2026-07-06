import type { FormEvent } from "react";

import { FormActions } from "@/components/ui/form-layout";
import {
  dayLabels,
  dayOrder,
  type DayOfWeekValue,
  type ScheduleRow,
} from "@/components/groups/group-schedule-model";

type GroupScheduleEditPanelProps = {
  schedule: ScheduleRow;
  dayOfWeek: DayOfWeekValue;
  startTime: string;
  durationMinutes: number;
  effectiveFrom: string;
  effectiveTo: string;
  savingEditId: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onQueueDelete: (schedule: ScheduleRow) => void;
  onDayOfWeekChange: (day: DayOfWeekValue) => void;
  onStartTimeChange: (time: string) => void;
  onDurationMinutesChange: (minutes: number) => void;
  onEffectiveFromChange: (value: string) => void;
  onEffectiveToChange: (value: string) => void;
};

export function GroupScheduleEditPanel({
  schedule,
  dayOfWeek,
  startTime,
  durationMinutes,
  effectiveFrom,
  effectiveTo,
  savingEditId,
  onSubmit,
  onCancel,
  onQueueDelete,
  onDayOfWeekChange,
  onStartTimeChange,
  onDurationMinutesChange,
  onEffectiveFromChange,
  onEffectiveToChange,
}: GroupScheduleEditPanelProps) {
  return (
    <div
      id="schedule-edit"
      className="rounded-lg border border-[var(--primary)]/25 bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)] sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--primary)]">Modification</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Modifier un horaire</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            La modification change la règle d&apos;horaire. Les séances déjà créées restent visibles dans le planning.
          </p>
        </div>
        <button type="button" onClick={onCancel} className="btn btn-ghost text-sm">
          Annuler
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Jour</label>
            <select
              value={dayOfWeek}
              onChange={(event) => onDayOfWeekChange(event.target.value as DayOfWeekValue)}
              className="field text-sm"
            >
              {dayOrder.map((day) => (
                <option key={day} value={day}>
                  {dayLabels[day]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Heure</label>
            <input
              type="time"
              value={startTime}
              onChange={(event) => onStartTimeChange(event.target.value)}
              className="field text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Durée (min)</label>
            <input
              type="number"
              min={30}
              max={240}
              step={5}
              value={durationMinutes}
              onChange={(event) => onDurationMinutesChange(Number(event.target.value))}
              className="field text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Appliqué du</label>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(event) => onEffectiveFromChange(event.target.value)}
              className="field text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Jusqu&apos;au</label>
            <input
              type="date"
              value={effectiveTo}
              onChange={(event) => onEffectiveToChange(event.target.value)}
              className="field text-sm"
            />
          </div>
        </div>

        <FormActions sticky>
          <button type="button" onClick={() => onQueueDelete(schedule)} className="btn btn-danger btn-block-mobile">
            Retirer l&apos;horaire
          </button>
          <button type="submit" disabled={savingEditId !== null} className="btn btn-primary btn-block-mobile">
            {savingEditId ? "Enregistrement..." : "Enregistrer l'horaire"}
          </button>
        </FormActions>
      </form>
    </div>
  );
}
