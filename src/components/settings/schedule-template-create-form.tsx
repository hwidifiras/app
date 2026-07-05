import type { FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";

import { CLUB_DAY_LABELS, WORKING_DAY_ORDER, type ClubDay } from "@/lib/club-working-days";
import type { ScheduleSlotInput } from "@/components/settings/schedule-template-ui";

type ScheduleTemplateCreateFormProps = {
  name: string;
  description: string;
  slots: ScheduleSlotInput[];
  loading: boolean;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSlotChange: (index: number, patch: Partial<ScheduleSlotInput>) => void;
  onSlotRemove: (index: number) => void;
  onSlotAdd: () => void;
  onSubmit: (event: FormEvent) => void;
};

export function ScheduleTemplateCreateForm({
  name,
  description,
  slots,
  loading,
  onNameChange,
  onDescriptionChange,
  onSlotChange,
  onSlotRemove,
  onSlotAdd,
  onSubmit,
}: ScheduleTemplateCreateFormProps) {
  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">Nom du modèle</span>
          <input className="field" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Ex. Ramadan 18h" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold">Description</span>
          <input className="field" value={description} onChange={(event) => onDescriptionChange(event.target.value)} placeholder="Optionnel" />
        </label>
      </div>

      <div className="space-y-2">
        {slots.map((slot, index) => (
          <div key={index} className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 md:grid-cols-[1fr_0.8fr_0.8fr_auto]">
            <select
              value={slot.dayOfWeek}
              onChange={(event) => onSlotChange(index, { dayOfWeek: event.target.value as ClubDay })}
              className="field"
            >
              {WORKING_DAY_ORDER.map((day) => (
                <option key={day} value={day}>
                  {CLUB_DAY_LABELS[day]}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={slot.startTime}
              onChange={(event) => onSlotChange(index, { startTime: event.target.value })}
              className="field"
            />
            <input
              type="number"
              min={30}
              max={240}
              step={15}
              value={slot.durationMinutes}
              onChange={(event) => onSlotChange(index, { durationMinutes: Number(event.target.value) })}
              className="field"
            />
            <button type="button" onClick={() => onSlotRemove(index)} className="btn btn-ghost px-3" aria-label="Retirer l'horaire">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <button type="button" onClick={onSlotAdd} className="btn btn-ghost">
          <Plus className="size-4" />
          Ajouter un horaire
        </button>
        <button type="submit" disabled={loading} className="btn btn-primary">
          Créer le modèle
        </button>
      </div>
    </form>
  );
}
