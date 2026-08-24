"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  FilterField,
  ListSearch,
  MobileFilterSheet,
  MobileFiltersButton,
} from "@/components/ui/list-controls";
import { Pagination } from "@/components/ui/pagination";
import { MemberCard } from "./member-card";
import { MemberRow } from "./member-row";
import {
  getMemberActiveFilterCount,
  getGroupLabel,
  groupMembersByGroup,
  type GroupOption,
  type MemberPaymentFilter,
  type MemberStatusFilter,
  type MemberViewMode,
  type MemberWithGroups,
  type SportOption,
} from "./member-list-model";
import type { MemberDirectoryPage } from "@/lib/member-directory";

type MemberListClientProps = {
  initialPage: MemberDirectoryPage;
  groupsOptions: GroupOption[];
  sportsOptions: SportOption[];
};

export function MemberListClient({ initialPage, groupsOptions, sportsOptions }: MemberListClientProps) {
  const [members, setMembers] = useState<MemberWithGroups[]>(initialPage.data);
  const [totalItems, setTotalItems] = useState(initialPage.total);
  const [pageCount, setPageCount] = useState(initialPage.pageCount);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<MemberStatusFilter>("ALL");
  const [viewMode, setViewMode] = useState<MemberViewMode>("LIST");
  const [sportFilter, setSportFilter] = useState<string>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<MemberPaymentFilter>("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [expandedMemberIds, setExpandedMemberIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(initialPage.page);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const hasMountedRef = useRef(false);

  function toggleExpandMember(memberId: string) {
    setExpandedMemberIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );
  }

  function resetPagingAndSelection() {
    setCurrentPage(1);
    setSelectedMemberIds([]);
  }

  function resetFilters() {
    setStatusFilter("ALL");
    setPaymentFilter("ALL");
    setSportFilter("ALL");
    setViewMode("LIST");
    resetPagingAndSelection();
  }

  const activeFilterCount = getMemberActiveFilterCount({
    statusFilter,
    paymentFilter,
    sportFilter,
    viewMode,
  });

  const groupedMembers = useMemo(
    () => groupMembersByGroup(members),
    [members],
  );

  const currentPageSafe = Math.min(currentPage, pageCount);
  const pageMembers = members;

  const loadDirectoryPage = useCallback(async (signal?: AbortSignal) => {
    const params = new URLSearchParams({
      page: String(currentPage),
      pageSize: String(initialPage.pageSize),
    });
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (paymentFilter !== "ALL") params.set("payment", paymentFilter);
    if (sportFilter !== "ALL") params.set("sportId", sportFilter);

    setDirectoryLoading(true);
    try {
      const response = await fetch(`/api/member-directory?${params.toString()}`, {
        cache: "no-store",
        signal,
      });
      const result = (await response.json()) as MemberDirectoryPage & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Impossible de charger les membres");

      setMembers(result.data);
      setTotalItems(result.total);
      setPageCount(result.pageCount);
      setCurrentPage(result.page);
      setExpandedMemberIds((current) => current.filter((id) => result.data.some((member) => member.id === id)));
    } finally {
      setDirectoryLoading(false);
    }
  }, [currentPage, initialPage.pageSize, paymentFilter, searchTerm, sportFilter, statusFilter]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    const controller = new AbortController();
    const delay = searchTerm.trim() ? 250 : 0;
    const timer = window.setTimeout(() => {
      void loadDirectoryPage(controller.signal).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setMessage(error instanceof Error ? error.message : "Impossible de charger les membres");
      });
    }, delay);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [loadDirectoryPage, searchTerm]);

  const reloadMembers = async () => {
    await loadDirectoryPage();
  };

  function toggleMemberSelection(memberId: string) {
    setSelectedMemberIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );
  }

  function toggleCurrentPageSelection() {
    const currentPageIds = pageMembers.map((member) => member.id);
    const hasAllSelected = currentPageIds.every((memberId) => selectedMemberIds.includes(memberId));

    setSelectedMemberIds((current) => {
      if (hasAllSelected) {
        return current.filter((memberId) => !currentPageIds.includes(memberId));
      }

      return Array.from(new Set([...current, ...currentPageIds]));
    });
  }

  async function bulkArchiveSelectedMembers() {
    if (selectedMemberIds.length === 0) return;

    setMessage(null);
    setActionLoadingId("bulk-archive");

    const results = await Promise.allSettled(
      selectedMemberIds.map(async (memberId) => {
        const response = await fetch(`/api/members/${memberId}`, { method: "DELETE" });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error ?? "Erreur lors de la résiliation");
        }
        return memberId;
      }),
    );

    const failedCount = results.filter((result) => result.status === "rejected").length;

    if (failedCount > 0) {
      setMessage(`Résiliation terminée avec ${failedCount} erreur(s)`);
    } else {
      setMessage("Membres résiliés avec succès");
    }

    setSelectedMemberIds([]);
    setBulkArchiveOpen(false);
    await reloadMembers();
    setActionLoadingId(null);
  }

  return (
    <div aria-busy={directoryLoading}>
      <div className="list-toolbar sticky top-[57px] z-20 -mx-2 mb-4 border-b border-[var(--border)] bg-[var(--surface)]/96 px-2 pb-3 pt-1 backdrop-blur lg:top-[var(--app-topbar-height)]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end">
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Recherche</label>
            <ListSearch
              value={searchTerm}
              onChange={(value) => {
                setSearchTerm(value);
                resetPagingAndSelection();
              }}
              placeholder="Nom, téléphone ou email..."
            />
          </div>
          <MobileFiltersButton onClick={() => setFiltersOpen(true)} count={activeFilterCount} />
          <Link href="/members/new" className="btn btn-primary min-h-11 min-w-0 shrink-0 px-3 sm:w-auto">
            + Ajouter un membre
          </Link>
        </div>

        <div className="mt-3 hidden grid-cols-4 gap-2 md:grid">
          <div>
            <label htmlFor="member-status-filter" className="mb-1 block text-xs font-medium text-muted-foreground">Statut</label>
            <select value={statusFilter} onChange={(e) => {
              setStatusFilter(e.target.value as typeof statusFilter);
              resetPagingAndSelection();
            }} id="member-status-filter" className="field text-xs">
              <option value="ALL">Tous les statuts</option>
              <option value="ACTIVE">Actifs</option>
              <option value="ARCHIVED">Résiliés</option>
            </select>
          </div>
          <div>
            <label htmlFor="member-payment-filter" className="mb-1 block text-xs font-medium text-muted-foreground">Paiement</label>
            <select value={paymentFilter} onChange={(e) => {
              setPaymentFilter(e.target.value as typeof paymentFilter);
              resetPagingAndSelection();
            }} id="member-payment-filter" className="field text-xs">
              <option value="ALL">Tous les paiements</option>
              <option value="PAID">Payé</option>
              <option value="PARTIAL">Partiel</option>
              <option value="UNPAID">Non payé</option>
            </select>
          </div>
          <div>
            <label htmlFor="member-sport-filter" className="mb-1 block text-xs font-medium text-muted-foreground">Discipline</label>
            <select value={sportFilter} onChange={(e) => {
              setSportFilter(e.target.value);
              resetPagingAndSelection();
            }} id="member-sport-filter" className="field text-xs">
              <option value="ALL">Toutes les disciplines</option>
              {sportsOptions.map((sport) => (
                <option key={sport.id} value={sport.id}>{sport.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="member-view-filter" className="mb-1 block text-xs font-medium text-muted-foreground">Affichage</label>
            <div className="flex gap-2">
              <select value={viewMode} onChange={(e) => {
                setViewMode(e.target.value as typeof viewMode);
                resetPagingAndSelection();
              }} id="member-view-filter" className="field min-w-0 flex-1 text-xs">
                <option value="LIST">Liste</option>
                <option value="GROUPED">Par groupe</option>
              </select>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="btn btn-ghost min-h-11 min-w-11 shrink-0 px-3"
                  title="Réinitialiser les filtres"
                  aria-label="Réinitialiser les filtres"
                >
                  <RotateCcw className="size-4" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <FeedbackMessage message={message} className="mb-3" />

      {viewMode === "LIST" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground" role="status" aria-live="polite">
              {directoryLoading ? "Chargement…" : `${totalItems} membre(s) trouvé(s)`} · page {currentPageSafe}/{pageCount}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {selectedMemberIds.length > 0 ? (
                <>
                  <span className="text-xs font-medium text-muted-foreground">{selectedMemberIds.length} sélectionné(s)</span>
                  <button type="button" onClick={() => setBulkArchiveOpen(true)} disabled={actionLoadingId === "bulk-archive"} className="btn btn-danger btn-block-mobile min-h-11 px-3 py-2 text-xs sm:w-auto">
                    {actionLoadingId === "bulk-archive" ? "Résiliation..." : "Résilier la sélection"}
                  </button>
                  <button type="button" onClick={() => setSelectedMemberIds([])} className="btn btn-ghost btn-block-mobile min-h-11 px-3 py-2 text-xs sm:w-auto">
                    Effacer
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {pageMembers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-muted-foreground xl:hidden">
              Aucun membre trouvé.
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:hidden" aria-label="Membres">
              {pageMembers.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  groupsOptions={groupsOptions}
                  selectable
                  selected={selectedMemberIds.includes(member.id)}
                  onToggleSelection={toggleMemberSelection}
                />
              ))}
            </ul>
          )}

          <div className="data-table hidden overflow-x-auto xl:block">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="w-10 px-4 py-3 text-left font-semibold">
                    <input
                      type="checkbox"
                      checked={pageMembers.length > 0 && pageMembers.every((member) => selectedMemberIds.includes(member.id))}
                      onChange={toggleCurrentPageSelection}
                      className="size-4 rounded border-border text-primary focus:ring-primary"
                      aria-label="Sélectionner la page"
                    />
                  </th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Nom</th>
                  <th scope="col" className="px-4 py-3 text-left font-semibold">Téléphone</th>
                  <th scope="col" className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Email</th>
                  <th scope="col" className="hidden px-4 py-3 text-left font-semibold lg:table-cell">Groupes</th>
                  <th scope="col" className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Paiement</th>
                  <th scope="col" className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Statut</th>
                  <th scope="col" className="hidden px-4 py-3 text-left font-semibold md:table-cell">Inscrit le</th>
                  <th scope="col" className="hidden px-4 py-3 text-right font-semibold md:table-cell">Actions</th>
                  <th scope="col" className="hidden px-4 py-3 text-center font-semibold">
                    <span className="sr-only">Détails</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageMembers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                      Aucun membre trouvé.
                    </td>
                  </tr>
                ) : (
                  pageMembers.map((member) => (
                    <MemberRow
                      key={member.id}
                      member={member}
                      groupsOptions={groupsOptions}
                      selectable
                      selected={selectedMemberIds.includes(member.id)}
                      expanded={expandedMemberIds.includes(member.id)}
                      onToggleSelection={toggleMemberSelection}
                      onToggleExpand={toggleExpandMember}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPageSafe}
            pageCount={pageCount}
            totalItems={totalItems}
            pageSize={initialPage.pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(groupedMembers.entries()).map(([groupId, rows]) => (
            <section key={groupId} className="rounded-lg border border-border bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">{getGroupLabel(groupId, groupsOptions)}</h3>
                <span className="text-xs text-muted-foreground">{rows.length} membre(s)</span>
              </div>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:hidden" aria-label={`Membres du groupe ${getGroupLabel(groupId, groupsOptions)}`}>
                {rows.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    groupsOptions={groupsOptions}
                  />
                ))}
              </ul>
              <div className="data-table mt-3 hidden overflow-x-auto rounded-lg border border-border shadow-[var(--shadow-panel)] xl:block">
                <table className="w-full text-sm">
                  <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left font-semibold">Nom</th>
                      <th scope="col" className="px-4 py-3 text-left font-semibold">Téléphone</th>
                      <th scope="col" className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Email</th>
                      <th scope="col" className="hidden px-4 py-3 text-left font-semibold lg:table-cell">Groupes</th>
                      <th scope="col" className="px-4 py-3 text-left font-semibold">Paiement</th>
                      <th scope="col" className="px-4 py-3 text-left font-semibold">Statut</th>
                      <th scope="col" className="hidden px-4 py-3 text-left font-semibold md:table-cell">Inscrit le</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.length === 0
                      ? null
                      : rows.map((member) => (
                          <MemberRow
                            key={member.id}
                            member={member}
                            groupsOptions={groupsOptions}
                            selected={selectedMemberIds.includes(member.id)}
                            expanded={expandedMemberIds.includes(member.id)}
                            onToggleSelection={toggleMemberSelection}
                            onToggleExpand={toggleExpandMember}
                          />
                        ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
          <Pagination
            currentPage={currentPageSafe}
            pageCount={pageCount}
            totalItems={totalItems}
            pageSize={initialPage.pageSize}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <MobileFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onReset={resetFilters}
        activeCount={activeFilterCount}
        resultCount={totalItems}
        title="Filtrer les membres"
      >
        <FilterField label="Statut">
          <select value={statusFilter} onChange={(e) => {
            setStatusFilter(e.target.value as typeof statusFilter);
            resetPagingAndSelection();
          }} className="field">
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">Actifs</option>
            <option value="ARCHIVED">Résiliés</option>
          </select>
        </FilterField>
        <FilterField label="Paiement">
          <select value={paymentFilter} onChange={(e) => {
            setPaymentFilter(e.target.value as typeof paymentFilter);
            resetPagingAndSelection();
          }} className="field">
            <option value="ALL">Tous les paiements</option>
            <option value="PAID">Payé</option>
            <option value="PARTIAL">Partiel</option>
            <option value="UNPAID">Non payé</option>
          </select>
        </FilterField>
        <FilterField label="Discipline">
          <select value={sportFilter} onChange={(e) => {
            setSportFilter(e.target.value);
            resetPagingAndSelection();
          }} className="field">
            <option value="ALL">Toutes les disciplines</option>
            {sportsOptions.map((sport) => (
              <option key={sport.id} value={sport.id}>{sport.name}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Affichage">
          <select value={viewMode} onChange={(e) => {
            setViewMode(e.target.value as typeof viewMode);
            resetPagingAndSelection();
          }} className="field">
            <option value="LIST">Liste</option>
            <option value="GROUPED">Par groupe</option>
          </select>
        </FilterField>
      </MobileFilterSheet>

      <ConfirmDialog
        open={bulkArchiveOpen}
        title={`Résilier ${selectedMemberIds.length} membre${selectedMemberIds.length > 1 ? "s" : ""} ?`}
        description="Les dossiers sélectionnés seront archivés. L'historique, les abonnements et les paiements resteront consultables."
        confirmLabel="Résilier la sélection"
        loading={actionLoadingId === "bulk-archive"}
        onCancel={() => setBulkArchiveOpen(false)}
        onConfirm={bulkArchiveSelectedMembers}
      />
    </div>
  );
}
