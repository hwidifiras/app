"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClipboardCheck, RotateCcw } from "lucide-react";
import type { AttendanceStatus } from "@prisma/client";

import { EmptyState } from "@/components/ui/empty-state";
import {
  FilterField,
  ListSearch,
  MobileFilterSheet,
  MobileFiltersButton,
} from "@/components/ui/list-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { Pagination, usePagination } from "@/components/ui/pagination";

export type AttendanceHistoryRow = {
  id: string;
  memberName: string;
  groupName: string;
  sessionDate: string;
  startTime: string;
  status: AttendanceStatus;
  overrideReason: string | null;
  checkedBy: string | null;
  checkedAt: string;
};

function statusVariant(status: AttendanceStatus) {
  if (status === "PRESENT") return "success";
  if (status === "ABSENT") return "danger";
  return "warning";
}

function statusLabel(status: AttendanceStatus) {
  if (status === "PRESENT") return "Présent";
  if (status === "ABSENT") return "Absent";
  return "Exception";
}

export function AttendanceHistoryList({ rows }: { rows: AttendanceHistoryRow[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AttendanceStatus>("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase("fr");
    return rows.filter((row) => {
      const matchesSearch =
        !query ||
        row.memberName.toLocaleLowerCase("fr").includes(query) ||
        row.groupName.toLocaleLowerCase("fr").includes(query) ||
        (row.checkedBy?.toLocaleLowerCase("fr").includes(query) ?? false);
      const matchesStatus = statusFilter === "ALL" || row.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, searchTerm, statusFilter]);

  const activeFilterCount = statusFilter === "ALL" ? 0 : 1;
  const pagination = usePagination(filteredRows, 20, `${searchTerm}|${statusFilter}`);

  function resetFilters() {
    setStatusFilter("ALL");
  }

  return (
    <>
      <div className="list-toolbar sticky top-[57px] z-20 -mx-2 mb-4 border-b border-[var(--border)] bg-[var(--surface)]/96 px-2 pb-3 pt-1 backdrop-blur lg:top-[3.5rem]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Recherche</label>
            <ListSearch
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Membre, groupe ou opérateur..."
            />
          </div>
          <MobileFiltersButton onClick={() => setFiltersOpen(true)} count={activeFilterCount} />
          <div className="hidden min-w-48 md:block">
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Statut</label>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                className="field text-xs"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="PRESENT">Présents</option>
                <option value="ABSENT">Absents</option>
                <option value="OVERRIDE">Exceptions</option>
              </select>
              {activeFilterCount > 0 ? (
                <button type="button" onClick={resetFilters} className="btn btn-ghost shrink-0 px-3" title="Réinitialiser">
                  <RotateCcw className="size-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          {filteredRows.length} pointage{filteredRows.length > 1 ? "s" : ""} affiché{filteredRows.length > 1 ? "s" : ""}
        </p>
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="size-8 opacity-45" />}
          title={rows.length === 0 ? "Aucun pointage" : "Aucun résultat"}
          message={
            rows.length === 0
              ? "Les présences et absences apparaîtront ici après une séance."
              : "Modifiez la recherche ou réinitialisez les filtres."
          }
          action={
            rows.length === 0 ? (
              <Link href="/attendance/today" className="btn btn-primary">Pointer une séance</Link>
            ) : (
              <button type="button" onClick={() => { setSearchTerm(""); resetFilters(); }} className="btn btn-ghost">
                Réinitialiser
              </button>
            )
          }
        />
      ) : (
        <div className="data-table overflow-x-auto rounded-lg border border-[var(--border)] shadow-[var(--shadow-panel)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Membre</th>
                <th className="px-4 py-3 text-left font-semibold">Groupe</th>
                <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Séance</th>
                <th className="px-4 py-3 text-left font-semibold">Statut</th>
                <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">Pointage</th>
                <th className="hidden px-4 py-3 text-left font-semibold lg:table-cell">Motif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {pagination.pageItems.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-[var(--surface-soft)]">
                  <td className="data-table-primary px-4 py-3 font-medium text-[var(--foreground)]" data-label="Membre">
                    {row.memberName}
                  </td>
                  <td className="px-4 py-3" data-label="Groupe">{row.groupName}</td>
                  <td className="hidden px-4 py-3 sm:table-cell" data-label="Séance">
                    {new Date(row.sessionDate).toLocaleDateString("fr-FR")}
                    <span className="ml-1 text-[var(--muted-foreground)]">({row.startTime})</span>
                  </td>
                  <td className="px-4 py-3" data-label="Statut">
                    <StatusBadge variant={statusVariant(row.status)}>{statusLabel(row.status)}</StatusBadge>
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--muted-foreground)] md:table-cell" data-label="Pointage">
                    {row.checkedBy ?? "Système"} · {new Date(row.checkedAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--muted-foreground)] lg:table-cell" data-label="Motif">
                    {row.overrideReason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        currentPage={pagination.currentPage}
        pageCount={pagination.pageCount}
        totalItems={filteredRows.length}
        onPageChange={pagination.setPage}
      />

      <MobileFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onReset={resetFilters}
        activeCount={activeFilterCount}
        resultCount={filteredRows.length}
        title="Filtrer les présences"
      >
        <FilterField label="Statut">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="field"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="PRESENT">Présents</option>
            <option value="ABSENT">Absents</option>
            <option value="OVERRIDE">Exceptions</option>
          </select>
        </FilterField>
      </MobileFilterSheet>
    </>
  );
}
