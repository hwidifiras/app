"use client";

import { useId, useRef } from "react";
import Link from "next/link";
import { RotateCcw, SlidersHorizontal, X } from "lucide-react";

import { FilterField, ListSearch } from "@/components/ui/list-controls";
import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";
import type { SessionStatusDto } from "@/types/session";

type PlanningFiltersToolbarProps = {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  groupId: string;
  groupsOptions: Array<{ id: string; name: string }>;
  onGroupChange: (groupId: string) => void;
  dayFilter: string;
  onDayFilterChange: (value: string) => void;
  statusFilter: "ALL" | SessionStatusDto;
  onStatusFilterChange: (value: "ALL" | SessionStatusDto) => void;
  activeFilterCount: number;
  resultCount: number;
  hiddenClosedDaysCount: number;
  closedDaysWithSessionsCount: number;
  onOpenMobileFilters: () => void;
  onResetFilters: () => void;
};

export function PlanningFiltersToolbar({
  searchTerm,
  onSearchChange,
  groupId,
  groupsOptions,
  onGroupChange,
  dayFilter,
  onDayFilterChange,
  statusFilter,
  onStatusFilterChange,
  activeFilterCount,
  resultCount,
  hiddenClosedDaysCount,
  closedDaysWithSessionsCount,
  onOpenMobileFilters,
  onResetFilters,
}: PlanningFiltersToolbarProps) {
  return (
    <div className="list-toolbar sticky top-[57px] z-20 -mx-2 mt-3 border-b border-[var(--border)] bg-[var(--surface)]/96 px-2 pb-3 pt-1 backdrop-blur lg:top-[var(--app-topbar-height)]">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-end">
        <div className="flex min-w-0 flex-1 items-end gap-2">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Recherche</label>
            <ListSearch
              value={searchTerm}
              onChange={onSearchChange}
              placeholder="Groupe, coach ou salle…"
            />
          </div>
          <button
            type="button"
            onClick={onOpenMobileFilters}
            className="btn btn-ghost min-h-11 shrink-0 xl:hidden"
            aria-label={activeFilterCount > 0 ? `Filtres, ${activeFilterCount} actif${activeFilterCount > 1 ? "s" : ""}` : "Filtres"}
          >
            <SlidersHorizontal className="size-4" />
            <span className="hidden sm:inline">Filtres</span>
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[0.65rem] text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        </div>

        <div className="hidden grid-cols-[minmax(11rem,1fr)_minmax(8rem,0.65fr)_minmax(9rem,0.75fr)_auto] items-end gap-2 xl:grid">
          <FilterField label="Groupe">
            <select value={groupId} onChange={(event) => onGroupChange(event.target.value)} className="field text-xs">
              <option value="">Tous les groupes</option>
              {groupsOptions.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </FilterField>
          <FilterField label="Jour">
            <select value={dayFilter} onChange={(event) => onDayFilterChange(event.target.value)} className="field text-xs">
              <option value="ALL">Tous les jours</option>
              <option value="1">Lundi</option><option value="2">Mardi</option><option value="3">Mercredi</option>
              <option value="4">Jeudi</option><option value="5">Vendredi</option><option value="6">Samedi</option><option value="0">Dimanche</option>
            </select>
          </FilterField>
          <FilterField label="Statut">
            <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as "ALL" | SessionStatusDto)} className="field text-xs">
              <option value="ALL">Tous les statuts</option>
              <option value="PLANNED">Planifiées</option><option value="RESCHEDULED">Reportées</option>
              <option value="CANCELLED">Annulées</option><option value="COMPLETED">Terminées</option>
            </select>
          </FilterField>
          {activeFilterCount > 0 ? (
            <button type="button" onClick={onResetFilters} className="btn btn-ghost min-h-11 min-w-11 px-3" title="Réinitialiser les filtres">
              <RotateCcw className="size-4" />
              <span className="sr-only">Réinitialiser les filtres</span>
            </button>
          ) : <span />}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted-foreground)]">
        <p>{resultCount} séance{resultCount > 1 ? "s" : ""} affichée{resultCount > 1 ? "s" : ""}</p>
        {dayFilter === "ALL" && (hiddenClosedDaysCount > 0 || closedDaysWithSessionsCount > 0) ? (
          <p className="min-w-0 rounded-md bg-blue-50 px-2 py-1 text-blue-900">
            {hiddenClosedDaysCount > 0 ? (
              <span className="font-semibold">
                {hiddenClosedDaysCount} jour{hiddenClosedDaysCount > 1 ? "s" : ""} fermé{hiddenClosedDaysCount > 1 ? "s" : ""} masqué{hiddenClosedDaysCount > 1 ? "s" : ""}.
              </span>
            ) : null}
            {closedDaysWithSessionsCount > 0 ? (
              <span className={hiddenClosedDaysCount > 0 ? "ml-1" : "font-semibold"}>
                {closedDaysWithSessionsCount} jour{closedDaysWithSessionsCount > 1 ? "s" : ""} fermé{closedDaysWithSessionsCount > 1 ? "s" : ""} avec séance reste visible.
              </span>
            ) : null}{" "}
            <Link href="/settings/club" prefetch={false} className="font-bold text-[var(--primary)] hover:underline">
              Régler les jours
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}

type PlanningMobileFilterSheetProps = {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  activeFilterCount: number;
  resultCount: number;
  groupId: string;
  groupsOptions: Array<{ id: string; name: string }>;
  onGroupChange: (groupId: string) => void;
  dayFilter: string;
  onDayFilterChange: (value: string) => void;
  statusFilter: "ALL" | SessionStatusDto;
  onStatusFilterChange: (value: "ALL" | SessionStatusDto) => void;
};

export function PlanningMobileFilterSheet({
  open,
  onClose,
  onReset,
  activeFilterCount,
  resultCount,
  groupId,
  groupsOptions,
  onGroupChange,
  dayFilter,
  onDayFilterChange,
  statusFilter,
  onStatusFilterChange,
}: PlanningMobileFilterSheetProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useAccessibleDialog<HTMLDivElement>({
    open,
    onClose,
    initialFocusRef: closeButtonRef,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-[var(--overlay)] xl:hidden" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="max-h-[86dvh] w-full overflow-y-auto rounded-t-xl border border-[var(--border)] bg-[var(--surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-floating)] sm:ml-auto sm:h-full sm:max-h-none sm:max-w-sm sm:rounded-l-xl sm:rounded-tr-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-semibold">Filtrer le planning</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              {activeFilterCount > 0 ? `${activeFilterCount} filtre${activeFilterCount > 1 ? "s" : ""} actif${activeFilterCount > 1 ? "s" : ""}` : "Aucun filtre actif"}
            </p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="btn btn-ghost min-h-11 min-w-11 p-2">
            <X className="size-5" />
            <span className="sr-only">Fermer</span>
          </button>
        </div>

        <div className="grid gap-4">
          <FilterField label="Groupe">
            <select value={groupId} onChange={(event) => onGroupChange(event.target.value)} className="field">
              <option value="">Tous les groupes</option>
              {groupsOptions.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </FilterField>
          <FilterField label="Jour">
            <select value={dayFilter} onChange={(event) => onDayFilterChange(event.target.value)} className="field">
              <option value="ALL">Tous les jours</option>
              <option value="1">Lundi</option><option value="2">Mardi</option><option value="3">Mercredi</option>
              <option value="4">Jeudi</option><option value="5">Vendredi</option><option value="6">Samedi</option><option value="0">Dimanche</option>
            </select>
          </FilterField>
          <FilterField label="Statut">
            <select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value as "ALL" | SessionStatusDto)} className="field">
              <option value="ALL">Tous les statuts</option>
              <option value="PLANNED">Planifiées</option><option value="RESCHEDULED">Reportées</option>
              <option value="CANCELLED">Annulées</option><option value="COMPLETED">Terminées</option>
            </select>
          </FilterField>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-4">
          <button type="button" onClick={onReset} className="btn btn-ghost min-h-12">
            <RotateCcw className="size-4" />
            Réinitialiser
          </button>
          <button type="button" onClick={onClose} className="btn btn-primary min-h-12">
            Voir {resultCount} résultat{resultCount > 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
