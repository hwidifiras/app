"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, RotateCcw, SlidersHorizontal, X } from "lucide-react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { StatusBadge } from "@/components/ui/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ListSearch } from "@/components/ui/list-controls";
import { Pagination } from "@/components/ui/pagination";

type GroupOption = {
  id: string;
  name: string;
  sportId: string;
};

type SportOption = {
  id: string;
  name: string;
};

type MemberWithGroups = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  memberType: "ADULT" | "KID" | "NOT_SPECIFIED";
  birthDate: string | null;
  address: string | null;
  parentName: string | null;
  parentPhone: string | null;
  parentAddress: string | null;
  status: "ACTIVE" | "ARCHIVED";
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
  joinedAt: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  groupIds: string[];
};

type MemberListClientProps = {
  initialMembers: MemberWithGroups[];
  groupsOptions: GroupOption[];
  sportsOptions: SportOption[];
};

const PAGE_SIZE = 10;

export function MemberListClient({ initialMembers, groupsOptions, sportsOptions }: MemberListClientProps) {
  const [members, setMembers] = useState<MemberWithGroups[]>(initialMembers);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ARCHIVED">("ALL");
  const [viewMode, setViewMode] = useState<"LIST" | "GROUPED">("LIST");
  const [sportFilter, setSportFilter] = useState<string>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | "PAID" | "PARTIAL" | "UNPAID">("ALL");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [expandedMemberIds, setExpandedMemberIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  useEffect(() => {
    if (!filtersOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setFiltersOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [filtersOpen]);

  function toggleExpandMember(memberId: string) {
    setExpandedMemberIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );
  }

  function paymentBadge(status: MemberWithGroups["paymentStatus"]) {
    if (status === "PAID") return { label: "Payé", className: "bg-emerald-100 text-emerald-700" };
    if (status === "PARTIAL") return { label: "Partiel", className: "bg-amber-100 text-amber-700" };
    return { label: "Non payé", className: "bg-rose-100 text-rose-700" };
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

  const activeFilterCount = [
    statusFilter !== "ALL",
    paymentFilter !== "ALL",
    sportFilter !== "ALL",
    viewMode !== "LIST",
  ].filter(Boolean).length;

  const filteredMembers = useMemo(
    () =>
      members.filter((member) => {
        const query = searchTerm.trim().toLowerCase();
        const matchesSearch =
          !query ||
          `${member.firstName} ${member.lastName}`.toLowerCase().includes(query) ||
          member.phone.toLowerCase().includes(query) ||
          (member.email?.toLowerCase() ?? "").includes(query);

        const matchesStatus = statusFilter === "ALL" || member.status === statusFilter;
        const matchesPayment = paymentFilter === "ALL" || member.paymentStatus === paymentFilter;
        const matchesSport =
          sportFilter === "ALL" ||
          member.groupIds.some((groupId) => groupsOptions.find((group) => group.id === groupId)?.sportId === sportFilter);

        return matchesSearch && matchesStatus && matchesPayment && matchesSport;
      }),
    [groupsOptions, members, paymentFilter, searchTerm, sportFilter, statusFilter],
  );

  const groupedMembers = useMemo(
    () =>
      filteredMembers.reduce((acc, member) => {
        if (member.groupIds.length === 0) {
          acc.set("UNASSIGNED", [...(acc.get("UNASSIGNED") ?? []), member]);
          return acc;
        }

        member.groupIds.forEach((groupId) => {
          const existing = acc.get(groupId) ?? [];
          acc.set(groupId, [...existing, member]);
        });

        return acc;
      }, new Map<string, MemberWithGroups[]>()),
    [filteredMembers],
  );

  const pageCount = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const currentPageSafe = Math.min(currentPage, pageCount);
  const pageStart = (currentPageSafe - 1) * PAGE_SIZE;
  const pageMembers = filteredMembers.slice(pageStart, pageStart + PAGE_SIZE);

  function groupLabel(groupId: string) {
    if (groupId === "UNASSIGNED") return "Sans groupe";
    return groupsOptions.find((group) => group.id === groupId)?.name ?? "Groupe";
  }

  const reloadMembers = async () => {
    const response = await fetch("/api/members", { cache: "no-store" });
    const result = await response.json();
    setMembers(result.data ?? []);
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

  async function bulkDeleteSelectedMembers() {
    if (selectedMemberIds.length === 0) return;

    setMessage(null);
    setActionLoadingId("bulk-delete");

    const results = await Promise.allSettled(
      selectedMemberIds.map(async (memberId) => {
        const response = await fetch(`/api/members/${memberId}`, { method: "DELETE" });
        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error ?? "Erreur lors de la suppression");
        }
        return memberId;
      }),
    );

    const failedCount = results.filter((result) => result.status === "rejected").length;

    if (failedCount > 0) {
      setMessage(`Suppression terminée avec ${failedCount} erreur(s)`);
    } else {
      setMessage("Membres supprimés avec succès");
    }

    setSelectedMemberIds([]);
    setBulkDeleteOpen(false);
    await reloadMembers();
    setActionLoadingId(null);
  }

  function renderMemberRow(member: MemberWithGroups, selectable = false) {
    const isExpanded = expandedMemberIds.includes(member.id);
    const payment = paymentBadge(member.paymentStatus);
    const firstGroupName =
      member.groupIds.length > 0
        ? groupsOptions.find((group) => group.id === member.groupIds[0])?.name ?? "Groupe"
        : "Sans groupe";

    return (
      <tr
        key={member.id}
        className={`mobile-collapsible-row transition-colors hover:bg-(--surface-soft) ${isExpanded ? "is-expanded" : ""}`}
      >
        {selectable ? (
          <td className="hidden px-4 py-3 align-top sm:table-cell">
            <input
              type="checkbox"
              checked={selectedMemberIds.includes(member.id)}
              onChange={() => toggleMemberSelection(member.id)}
              className="size-4 rounded border-border text-primary focus:ring-primary"
            />
          </td>
        ) : null}
        <td className="data-table-primary px-4 py-3 font-medium" data-label="Nom">
          <Link
            href={`/members/${member.id}`}
            className="text-foreground hover:text-[var(--primary)] hover:underline"
          >
            {member.firstName} {member.lastName}
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 md:hidden">
            <span className="chip chip-muted px-1.5 py-0.5 text-[10px]">{member.phone}</span>
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${payment.className}`}>
              {payment.label}
            </span>
            <StatusBadge
              variant={member.status === "ACTIVE" ? "success" : "muted"}
              className="px-1.5 py-0.5 text-[10px]"
            >
              {member.status === "ACTIVE" ? "Actif" : "Résilié"}
            </StatusBadge>
            <span className="chip chip-muted max-w-full truncate px-1.5 py-0.5 text-[10px]">{firstGroupName}</span>
          </div>
        </td>
        <td className="px-4 py-3 mobile-detail-cell" data-label="Téléphone">{member.phone}</td>
        <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell mobile-detail-cell" data-label="Email">{member.email ?? "-"}</td>
        <td className="hidden px-4 py-3 lg:table-cell mobile-detail-cell" data-label="Groupes">
          {member.groupIds.length === 0 ? (
            <span className="text-xs text-muted-foreground">-</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {member.groupIds.map((groupId) => {
                const groupName = groupsOptions.find((group) => group.id === groupId)?.name ?? groupId.slice(0, 6);
                return (
                  <span key={groupId} className="chip chip-muted px-1.5 py-0.5 text-[10px]">
                    {groupName}
                  </span>
                );
              })}
            </div>
          )}
        </td>
        <td className="px-4 py-3 mobile-detail-cell" data-label="Paiement">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-semibold ${paymentBadge(member.paymentStatus).className}`}>
            {paymentBadge(member.paymentStatus).label}
          </span>
        </td>
        <td className="px-4 py-3 mobile-detail-cell" data-label="Statut">
          <StatusBadge variant={member.status === "ACTIVE" ? "success" : "muted"}>{member.status === "ACTIVE" ? "Actif" : "Résilié"}</StatusBadge>
        </td>
        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell mobile-detail-cell" data-label="Inscrit le">{new Date(member.createdAt).toLocaleDateString("fr-FR")}</td>
        <td className="card-actions-cell px-4 py-3 text-right" data-label="Actions">
          <Link href={`/members/${member.id}`} className="btn btn-ghost min-h-0 px-2 py-1 text-xs">
            Détails
          </Link>
        </td>
        <td className="px-4 py-3 text-center md:hidden mobile-toggle-cell">
          <button
            type="button"
            className="mobile-card-toggle w-full"
            onClick={() => toggleExpandMember(member.id)}
            aria-expanded={isExpanded}
          >
            {isExpanded ? "Voir moins" : "Voir plus"}
            <ChevronDown className={`size-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <div>
      <div className="sticky top-[57px] z-20 -mx-2 mb-4 border-b border-[var(--border)] bg-[var(--surface)]/96 px-2 pb-3 pt-1 backdrop-blur lg:top-[3.5rem]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
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
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="btn btn-ghost min-h-12 shrink-0 sm:min-h-[2.75rem] md:hidden"
          >
            <SlidersHorizontal className="size-4" />
            Filtres
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[0.65rem] text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
          <Link href="/members/new" className="btn btn-primary btn-block-mobile shrink-0 sm:w-auto">
            + Ajouter un membre
          </Link>
        </div>

        <div className="mt-3 hidden grid-cols-4 gap-2 md:grid">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Statut</label>
            <select value={statusFilter} onChange={(e) => {
              setStatusFilter(e.target.value as typeof statusFilter);
              resetPagingAndSelection();
            }} className="field text-xs">
              <option value="ALL">Tous les statuts</option>
              <option value="ACTIVE">Actifs</option>
              <option value="ARCHIVED">Résiliés</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Paiement</label>
            <select value={paymentFilter} onChange={(e) => {
              setPaymentFilter(e.target.value as typeof paymentFilter);
              resetPagingAndSelection();
            }} className="field text-xs">
              <option value="ALL">Tous les paiements</option>
              <option value="PAID">Payé</option>
              <option value="PARTIAL">Partiel</option>
              <option value="UNPAID">Non payé</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Discipline</label>
            <select value={sportFilter} onChange={(e) => {
              setSportFilter(e.target.value);
              resetPagingAndSelection();
            }} className="field text-xs">
              <option value="ALL">Toutes les disciplines</option>
              {sportsOptions.map((sport) => (
                <option key={sport.id} value={sport.id}>{sport.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Affichage</label>
            <div className="flex gap-2">
              <select value={viewMode} onChange={(e) => {
                setViewMode(e.target.value as typeof viewMode);
                resetPagingAndSelection();
              }} className="field min-w-0 flex-1 text-xs">
                <option value="LIST">Liste</option>
                <option value="GROUPED">Par groupe</option>
              </select>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="btn btn-ghost min-h-0 shrink-0 px-3"
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
            <div className="text-xs text-muted-foreground">
              {filteredMembers.length} membre(s) trouvé(s) · page {currentPageSafe}/{pageCount}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {selectedMemberIds.length > 0 ? (
                <>
                  <span className="text-xs font-medium text-muted-foreground">{selectedMemberIds.length} sélectionné(s)</span>
                  <button type="button" onClick={() => setBulkDeleteOpen(true)} disabled={actionLoadingId === "bulk-delete"} className="btn btn-danger btn-block-mobile min-h-11 px-3 py-2 text-xs sm:w-auto">
                    {actionLoadingId === "bulk-delete" ? "Suppression..." : "Supprimer la sélection"}
                  </button>
                  <button type="button" onClick={() => setSelectedMemberIds([])} className="btn btn-ghost btn-block-mobile min-h-11 px-3 py-2 text-xs sm:w-auto">
                    Effacer
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="data-table overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-(--surface-soft) text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-10 px-4 py-3 text-left font-semibold">
                    <input
                      type="checkbox"
                      checked={pageMembers.length > 0 && pageMembers.every((member) => selectedMemberIds.includes(member.id))}
                      onChange={toggleCurrentPageSelection}
                      className="size-4 rounded border-border text-primary focus:ring-primary"
                      aria-label="Sélectionner la page"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">Nom</th>
                  <th className="px-4 py-3 text-left font-semibold">Téléphone</th>
                  <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Email</th>
                  <th className="hidden px-4 py-3 text-left font-semibold lg:table-cell">Groupes</th>
                  <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Paiement</th>
                  <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Statut</th>
                  <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">Inscrit le</th>
                  <th className="hidden px-4 py-3 text-right font-semibold md:table-cell">Actions</th>
                  <th className="px-4 py-3 text-center md:hidden font-semibold"> </th>
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
                  pageMembers.map((member) => renderMemberRow(member, true))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPageSafe}
            pageCount={pageCount}
            totalItems={filteredMembers.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(groupedMembers.entries()).map(([groupId, rows]) => (
            <section key={groupId} className="rounded-xl border-border p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">{groupLabel(groupId)}</h3>
                <span className="text-xs text-muted-foreground">{rows.length} membre(s)</span>
              </div>
              <div className="data-table mt-3 overflow-x-auto rounded-xl border-border">
                <table className="w-full text-sm">
                  <thead className="bg-(--surface-soft) text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Nom</th>
                      <th className="px-4 py-3 text-left font-semibold">Téléphone</th>
                      <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Email</th>
                      <th className="hidden px-4 py-3 text-left font-semibold lg:table-cell">Groupes</th>
                      <th className="px-4 py-3 text-left font-semibold">Paiement</th>
                      <th className="px-4 py-3 text-left font-semibold">Statut</th>
                      <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">Inscrit le</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">{rows.length === 0 ? null : rows.map((member) => renderMemberRow(member, false))}</tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {filtersOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-end bg-black/40 md:hidden"
          onClick={() => setFiltersOpen(false)}
          role="presentation"
        >
          <div
            className="max-h-[86dvh] w-full overflow-y-auto rounded-t-3xl border border-[var(--border)] bg-[var(--surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-floating)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-filters-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 id="member-filters-title" className="text-lg font-semibold">Filtrer les membres</h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {activeFilterCount > 0 ? `${activeFilterCount} filtre(s) actif(s)` : "Aucun filtre actif"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="btn btn-ghost min-h-11 min-w-11 rounded-full p-2"
                aria-label="Fermer les filtres"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="grid gap-4">
              <label className="grid gap-1 text-xs font-medium text-[var(--muted-foreground)]">
                Statut
                <select value={statusFilter} onChange={(e) => {
                  setStatusFilter(e.target.value as typeof statusFilter);
                  resetPagingAndSelection();
                }} className="field">
                  <option value="ALL">Tous les statuts</option>
                  <option value="ACTIVE">Actifs</option>
                  <option value="ARCHIVED">Résiliés</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted-foreground)]">
                Paiement
                <select value={paymentFilter} onChange={(e) => {
                  setPaymentFilter(e.target.value as typeof paymentFilter);
                  resetPagingAndSelection();
                }} className="field">
                  <option value="ALL">Tous les paiements</option>
                  <option value="PAID">Payé</option>
                  <option value="PARTIAL">Partiel</option>
                  <option value="UNPAID">Non payé</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted-foreground)]">
                Discipline
                <select value={sportFilter} onChange={(e) => {
                  setSportFilter(e.target.value);
                  resetPagingAndSelection();
                }} className="field">
                  <option value="ALL">Toutes les disciplines</option>
                  {sportsOptions.map((sport) => (
                    <option key={sport.id} value={sport.id}>{sport.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted-foreground)]">
                Affichage
                <select value={viewMode} onChange={(e) => {
                  setViewMode(e.target.value as typeof viewMode);
                  resetPagingAndSelection();
                }} className="field">
                  <option value="LIST">Liste</option>
                  <option value="GROUPED">Par groupe</option>
                </select>
              </label>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-4">
              <button type="button" onClick={resetFilters} className="btn btn-ghost min-h-12">
                <RotateCcw className="size-4" />
                Réinitialiser
              </button>
              <button type="button" onClick={() => setFiltersOpen(false)} className="btn btn-primary min-h-12">
                Voir {filteredMembers.length} résultat{filteredMembers.length > 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={bulkDeleteOpen}
        title={`Supprimer ${selectedMemberIds.length} membre${selectedMemberIds.length > 1 ? "s" : ""} ?`}
        description="Les dossiers sélectionnés et toutes leurs données associées seront supprimés définitivement."
        confirmLabel="Supprimer définitivement"
        loading={actionLoadingId === "bulk-delete"}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={bulkDeleteSelectedMembers}
      />
    </div>
  );
}
