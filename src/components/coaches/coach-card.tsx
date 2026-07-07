import { Pencil, Trash2 } from "lucide-react";

import type { CoachDto } from "@/types/coach";
import type { SportDto } from "@/types/sport";
import {
  CoachGroupsPreview,
  CoachLoadSummary,
  CoachSpecialtyChips,
} from "@/components/coaches/coach-manager-ui";
import { toggleSportId, withPrimarySport } from "@/components/coaches/coach-manager-model";

type CoachCardProps = {
  coach: CoachDto;
  sports: SportDto[];
  editing: boolean;
  actionBusy: boolean;
  editFirstName: string;
  editLastName: string;
  editPhone: string;
  editEmail: string;
  editBirthDate: string;
  editSportId: string;
  editQualifiedSportIds: string[];
  editIsActive: boolean;
  onReloadSports: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onQueueDelete: () => void;
  onEditFirstNameChange: (value: string) => void;
  onEditLastNameChange: (value: string) => void;
  onEditPhoneChange: (value: string) => void;
  onEditEmailChange: (value: string) => void;
  onEditBirthDateChange: (value: string) => void;
  onEditSportIdChange: (value: string) => void;
  onEditQualifiedSportIdsChange: (value: string[]) => void;
  onEditIsActiveChange: (value: boolean) => void;
};

export function CoachCard({
  coach,
  sports,
  editing,
  actionBusy,
  editFirstName,
  editLastName,
  editPhone,
  editEmail,
  editBirthDate,
  editSportId,
  editQualifiedSportIds,
  editIsActive,
  onReloadSports,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onQueueDelete,
  onEditFirstNameChange,
  onEditLastNameChange,
  onEditPhoneChange,
  onEditEmailChange,
  onEditBirthDateChange,
  onEditSportIdChange,
  onEditQualifiedSportIdsChange,
  onEditIsActiveChange,
}: CoachCardProps) {
  const birthDateLabel = coach.birthDate
    ? new Date(coach.birthDate).toLocaleDateString("fr-FR")
    : null;

  return (
    <li className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
      {editing ? (
        <div className="space-y-2">
          <input
            aria-label="Prénom du coach"
            value={editFirstName}
            onChange={(e) => onEditFirstNameChange(e.target.value)}
            placeholder="Prénom"
            className="field text-xs"
          />
          <input
            aria-label="Nom du coach"
            value={editLastName}
            onChange={(e) => onEditLastNameChange(e.target.value)}
            placeholder="Nom"
            className="field text-xs"
          />
          <input
            aria-label="Téléphone du coach"
            value={editPhone}
            onChange={(e) => onEditPhoneChange(e.target.value)}
            placeholder="Téléphone"
            className="field text-xs"
          />
          <input
            aria-label="Email du coach"
            value={editEmail}
            onChange={(e) => onEditEmailChange(e.target.value)}
            placeholder="Email"
            className="field text-xs"
            type="email"
          />
          <input
            aria-label="Date de naissance du coach"
            value={editBirthDate}
            onChange={(e) => onEditBirthDateChange(e.target.value)}
            className="field text-xs"
            type="date"
          />
          <select
            aria-label="Spécialité principale du coach"
            value={editSportId}
            onFocus={onReloadSports}
            onClick={onReloadSports}
            onChange={(e) => {
              const nextSportId = e.target.value;
              onEditSportIdChange(nextSportId);
              if (nextSportId) {
                onEditQualifiedSportIdsChange(withPrimarySport(editQualifiedSportIds, nextSportId));
              }
            }}
            className="field text-xs"
          >
            <option value="">Spécialité à compléter</option>
            {sports.map((sport) => (
              <option key={sport.id} value={sport.id}>
                {sport.name}
              </option>
            ))}
          </select>
          {sports.length > 0 ? (
            <div>
              <p className="mb-1 text-xs font-semibold text-[var(--muted-foreground)]">Disciplines autorisées</p>
              <div className="grid gap-1 sm:grid-cols-2">
                {sports.map((sport) => (
                  <label key={sport.id} className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <input
                      type="checkbox"
                      checked={withPrimarySport(editQualifiedSportIds, editSportId).includes(sport.id)}
                      disabled={sport.id === editSportId}
                      onChange={() => onEditQualifiedSportIdsChange(toggleSportId(editQualifiedSportIds, sport.id))}
                    />
                    <span className="truncate text-[var(--foreground)]">{sport.name}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
            <input
              type="checkbox"
              checked={editIsActive}
              onChange={(e) => onEditIsActiveChange(e.target.checked)}
            />
            Coach actif
          </label>
          <div className="list-card-actions mt-3">
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={actionBusy}
              className="btn btn-primary btn-block-mobile"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={actionBusy}
              className="btn btn-ghost btn-block-mobile"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-xs font-bold text-[var(--primary)]">
                {coach.firstName[0]}
                {coach.lastName[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[var(--foreground)]">
                  {coach.firstName} {coach.lastName}
                </p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  {coach.phone}
                  {coach.email ? ` · ${coach.email}` : ""}
                </p>
                {birthDateLabel ? (
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    Né(e) le {birthDateLabel}
                  </p>
                ) : null}
                <div className="mt-2">
                  <CoachSpecialtyChips coach={coach} />
                </div>
              </div>
            </div>
            <div className="list-card-actions mt-1 shrink-0 md:mt-0 md:justify-end">
              <button
                type="button"
                onClick={onStartEdit}
                disabled={actionBusy}
                className="btn btn-ghost btn-sm inline-flex items-center justify-center md:size-9 md:p-0"
                title="Modifier"
                aria-label="Modifier"
              >
                <Pencil className="size-4" />
                <span className="md:hidden">Modifier</span>
              </button>
              <button
                type="button"
                onClick={onQueueDelete}
                disabled={actionBusy}
                className="btn btn-ghost btn-sm inline-flex items-center justify-center border-red-200 text-red-700 hover:bg-red-50 md:size-9 md:p-0"
                title="Désactiver"
                aria-label="Désactiver"
              >
                <Trash2 className="size-4" />
                <span className="md:hidden">Désactiver</span>
              </button>
            </div>
          </div>
          <CoachLoadSummary coach={coach} />
          <CoachGroupsPreview coach={coach} />
        </div>
      )}
    </li>
  );
}
