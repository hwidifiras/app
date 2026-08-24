import { CheckCircle2, Dumbbell, MoreHorizontal, Settings2, X } from "lucide-react";

import { FormField } from "@/components/ui/form-layout";
import { DemoMutationButton } from "@/components/ui/demo-read-only";
import { StatusBadge } from "@/components/ui/status-badge";
import type { SportDto } from "@/types/sport";
import { cn } from "@/lib/utils";
import { EMPTY_STATS, completionState, plural } from "@/components/sports/sport-manager-model";

type SportCardProps = {
  sport: SportDto;
  menuOpen: boolean;
  editing: boolean;
  actionBusy: boolean;
  editName: string;
  editDescription: string;
  editIsActive: boolean;
  onToggleMenu: () => void;
  onToggleActive: () => void;
  onQueueDelete: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditNameChange: (value: string) => void;
  onEditDescriptionChange: (value: string) => void;
  onEditIsActiveChange: (value: boolean) => void;
};

function DisciplineStat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-md bg-[var(--surface-soft)] px-3 py-2">
      <p className="text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-base font-bold text-[var(--foreground)]">
        {value}
        {hint ? <span className="ml-1 text-xs font-medium text-[var(--muted-foreground)]">{hint}</span> : null}
      </p>
    </div>
  );
}

export function SportCard({
  sport,
  menuOpen,
  editing,
  actionBusy,
  editName,
  editDescription,
  editIsActive,
  onToggleMenu,
  onToggleActive,
  onQueueDelete,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditNameChange,
  onEditDescriptionChange,
  onEditIsActiveChange,
}: SportCardProps) {
  const state = completionState(sport);
  const stats = sport.stats ?? EMPTY_STATS;

  return (
    <li
      className={cn(
        "relative overflow-visible rounded-lg border bg-[var(--surface)] p-3 shadow-[var(--shadow-panel)] transition hover:border-[var(--primary)]/30 hover:shadow-[var(--shadow-floating)] sm:p-4",
        !sport.isActive && "bg-[var(--surface-soft)]/65",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
            <Dumbbell className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-[var(--foreground)]">{sport.name}</h3>
              <StatusBadge variant={sport.isActive ? "success" : "muted"}>
                {sport.isActive ? "Actif" : "Inactif"}
              </StatusBadge>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-[var(--muted-foreground)]">
              {sport.description?.trim() || "Aucune description."}
            </p>
          </div>
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={onToggleMenu}
            className="btn btn-ghost btn-sm min-w-9 px-2"
            aria-label={`Actions pour ${sport.name}`}
            aria-expanded={menuOpen}
          >
            <MoreHorizontal className="size-4" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-floating)]">
              <DemoMutationButton
                type="button"
                onClick={onToggleActive}
                disabled={actionBusy}
                className="inline-flex w-full items-center gap-1.5 rounded-md px-2.5 py-2 text-left text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-soft)] disabled:opacity-50"
              >
                {sport.isActive ? "Désactiver" : "Réactiver"}
              </DemoMutationButton>
              <button
                type="button"
                onClick={onQueueDelete}
                disabled={actionBusy}
                className="w-full rounded-md px-2.5 py-2 text-left text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:opacity-50"
              >
                Desactiver...
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface-soft)]/65 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge variant={state.variant}>{state.label}</StatusBadge>
          <p className="text-xs text-[var(--muted-foreground)]">{state.detail}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <DisciplineStat label="Cours" value={stats.activeGroups} />
        <DisciplineStat label="Formules" value={stats.activePlans} />
        <DisciplineStat label="Coachs" value={stats.coaches} />
        <DisciplineStat label="Abonnements" value={stats.activeSubscriptions} hint="actifs" />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
        <p className="text-xs text-[var(--muted-foreground)]">
          {plural(stats.activeOffers, "offre")} active{stats.activeOffers > 1 ? "s" : ""}
        </p>
        <button
          type="button"
          onClick={() => (editing ? onCancelEdit() : onStartEdit())}
          disabled={actionBusy}
          className={cn("btn btn-sm btn-block-mobile sm:w-auto", editing ? "btn-ghost" : "btn-primary")}
        >
          {editing ? <X className="size-3.5" /> : <Settings2 className="size-3.5" />}
          {editing ? "Fermer" : "Configurer"}
        </button>
      </div>

      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSaveEdit();
          }}
          className="mt-4 space-y-3 border-t border-[var(--border)] pt-4"
        >
          <FormField label="Nom" htmlFor={`sport-edit-name-${sport.id}`}>
            <input
              id={`sport-edit-name-${sport.id}`}
              aria-label="Nom de la discipline"
              value={editName}
              onChange={(event) => onEditNameChange(event.target.value)}
              placeholder="Nom de la discipline"
              className="field text-sm"
              required
            />
          </FormField>
          <FormField label="Description" htmlFor={`sport-edit-description-${sport.id}`} hint="Optionnelle">
            <textarea
              id={`sport-edit-description-${sport.id}`}
              aria-label="Description de la discipline"
              value={editDescription}
              onChange={(event) => onEditDescriptionChange(event.target.value)}
              placeholder="Public, niveau ou particularités..."
              className="field text-sm"
              rows={2}
            />
          </FormField>
          <label className="flex items-center gap-2 rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-sm text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={editIsActive}
              onChange={(event) => onEditIsActiveChange(event.target.checked)}
            />
            Discipline active
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onCancelEdit} disabled={actionBusy} className="btn btn-ghost btn-block-mobile">
              Annuler
            </button>
            <DemoMutationButton type="submit" disabled={actionBusy} className="btn btn-primary btn-block-mobile">
              <CheckCircle2 className="size-4" />
              {actionBusy ? "Enregistrement..." : "Enregistrer"}
            </DemoMutationButton>
          </div>
        </form>
      ) : null}
    </li>
  );
}
