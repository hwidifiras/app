import Link from "next/link";
import { RotateCcw } from "lucide-react";

import {
  FilterField,
  ListSearch,
  MobileFiltersButton,
} from "@/components/ui/list-controls";
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
    <div className="list-toolbar sticky top-[57px] z-20 -mx-2 mt-3 border-b border-[var(--border)] bg-[var(--surface)]/96 px-2 pb-3 pt-1 backdrop-blur lg:top-[3.5rem]">
      <div className="flex flex-col gap-2 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Recherche</label>
          <ListSearch
            value={searchTerm}
            onChange={onSearchChange}
            placeholder="Groupe, coach ou salle..."
          />
        </div>
        <MobileFiltersButton onClick={onOpenMobileFilters} count={activeFilterCount} />
        <div className="hidden grid-cols-[minmax(11rem,1fr)_minmax(9rem,0.7fr)_minmax(10rem,0.8fr)_auto] items-end gap-2 md:grid">
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
            <button type="button" onClick={onResetFilters} className="btn btn-ghost px-3" title="Réinitialiser">
              <RotateCcw className="size-4" />
            </button>
          ) : <span />}
        </div>
      </div>
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        {resultCount} séance{resultCount > 1 ? "s" : ""} affichée{resultCount > 1 ? "s" : ""}
      </p>
      {dayFilter === "ALL" && (hiddenClosedDaysCount > 0 || closedDaysWithSessionsCount > 0) ? (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {hiddenClosedDaysCount > 0 ? (
              <span className="font-semibold">
                {hiddenClosedDaysCount} jour{hiddenClosedDaysCount > 1 ? "s" : ""} fermé{hiddenClosedDaysCount > 1 ? "s" : ""} sans cours masqué{hiddenClosedDaysCount > 1 ? "s" : ""}.
              </span>
            ) : null}
            {closedDaysWithSessionsCount > 0 ? (
              <span className={hiddenClosedDaysCount > 0 ? "ml-1" : "font-semibold"}>
                {closedDaysWithSessionsCount} jour{closedDaysWithSessionsCount > 1 ? "s" : ""} fermé{closedDaysWithSessionsCount > 1 ? "s" : ""} reste{closedDaysWithSessionsCount > 1 ? "nt" : ""} visible{closedDaysWithSessionsCount > 1 ? "s" : ""} car des séances existent dessus.
              </span>
            ) : null}
          </div>
          <Link href="/settings/club" prefetch={false} className="shrink-0 font-bold text-[var(--primary)] hover:underline">
            Régler les jours
          </Link>
        </div>
      ) : null}
    </div>
  );
}
