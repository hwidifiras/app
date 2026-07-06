import type { FormEvent } from "react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";
import {
  dayLabels,
  type DayOfWeekValue,
  type DaySelection,
} from "@/components/groups/group-schedule-model";

type GroupScheduleNewPeriodFormProps = {
  daySelections: DaySelection[];
  schedulesCount: number;
  durationMinutes: number;
  effectiveFrom: string;
  effectiveTo: string;
  autoGenerate: boolean;
  loading: boolean;
  message: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onPrefillFromCurrent: () => void;
  onToggleDay: (day: DayOfWeekValue) => void;
  onUpdateDayTime: (day: DayOfWeekValue, time: string) => void;
  onDurationMinutesChange: (minutes: number) => void;
  onEffectiveFromChange: (value: string) => void;
  onEffectiveToChange: (value: string) => void;
  onAutoGenerateChange: (checked: boolean) => void;
};

export function GroupScheduleNewPeriodForm({
  daySelections,
  schedulesCount,
  durationMinutes,
  effectiveFrom,
  effectiveTo,
  autoGenerate,
  loading,
  message,
  onSubmit,
  onPrefillFromCurrent,
  onToggleDay,
  onUpdateDayTime,
  onDurationMinutesChange,
  onEffectiveFromChange,
  onEffectiveToChange,
  onAutoGenerateChange,
}: GroupScheduleNewPeriodFormProps) {
  return (
    <div
      id="schedule-new"
      className="form-section-anchor rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)] sm:p-6"
    >
      <h2 className="text-lg font-semibold text-[var(--foreground)]">Nouvelle période d&apos;horaires</h2>
      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
        Créez une période quand les horaires changent pour une saison, des vacances ou un cycle temporaire. Les dates
        appartiennent à cette période d&apos;horaires, pas au groupe.
      </p>

      <form onSubmit={onSubmit} className="mt-5 space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
              Début de la période
            </label>
            <input
              type="date"
              value={effectiveFrom}
              onChange={(event) => onEffectiveFromChange(event.target.value)}
              className="field text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
              Fin de la période (optionnel)
            </label>
            <input
              type="date"
              value={effectiveTo}
              onChange={(event) => onEffectiveToChange(event.target.value)}
              className="field text-sm"
            />
            <p className="mt-1 text-[0.68rem] text-[var(--muted-foreground)]">
              Laisser vide si ces horaires restent actifs sans date de fin.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
              Durée par séance (min)
            </label>
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
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--foreground)]">Jours fixes de la semaine</p>
            {schedulesCount > 0 ? (
              <button type="button" onClick={onPrefillFromCurrent} className="btn btn-ghost min-h-0 px-2 py-1 text-xs">
                Copier les horaires actuels
              </button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {daySelections.map((selection) => (
              <label
                key={selection.day}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  selection.checked
                    ? "border-[var(--primary)] bg-[var(--primary)]/5"
                    : "border-[var(--border)] hover:bg-[var(--surface-soft)]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selection.checked}
                  onChange={() => onToggleDay(selection.day)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                <span className="flex-1 text-sm font-medium text-[var(--foreground)]">
                  {dayLabels[selection.day]}
                </span>
                {selection.checked ? (
                  <input
                    type="time"
                    value={selection.startTime}
                    onChange={(event) => onUpdateDayTime(selection.day, event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    className="field w-[100px] text-sm"
                    required={selection.checked}
                  />
                ) : null}
              </label>
            ))}
          </div>
        </div>

        <label className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 text-sm">
          <input
            type="checkbox"
            checked={autoGenerate}
            onChange={(event) => onAutoGenerateChange(event.target.checked)}
            className="mt-1 h-4 w-4 accent-[var(--primary)]"
          />
          <span>
            <span className="block font-semibold text-[var(--foreground)]">Générer les séances après enregistrement</span>
            <span className="block text-xs text-[var(--muted-foreground)]">
              Crée les séances datées à venir pour le pointage. Décochez si vous voulez seulement préparer les horaires.
            </span>
          </span>
        </label>

        <FormActions sticky>
          <button type="submit" disabled={loading} className="btn btn-primary btn-block-mobile">
            {loading ? "Enregistrement..." : autoGenerate ? "Enregistrer et générer les séances" : "Enregistrer la période"}
          </button>
        </FormActions>
      </form>

      <FeedbackMessage message={message} className="mt-3" />
    </div>
  );
}
