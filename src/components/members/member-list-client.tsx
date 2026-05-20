"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { StatusBadge } from "@/components/ui/status-badge";

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

  async function archiveMember(memberId: string) {
    const confirmed = window.confirm("Confirmer la résiliation de ce membre ?");
    if (!confirmed) return;

    setActionLoadingId(memberId);
    setMessage(null);

    const response = await fetch("/api/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la résiliation");
      setActionLoadingId(null);
      return;
    }

    setMessage("Membre résilié avec succès");
    await reloadMembers();
    setActionLoadingId(null);
  }

  async function deleteMember(memberId: string) {
    const confirmed = window.confirm("Confirmer la suppression définitive de ce membre ? Cette action est irréversible.");
    if (!confirmed) return;

    setActionLoadingId(memberId);
    setMessage(null);

    const response = await fetch(`/api/members/${memberId}`, { method: "DELETE" });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la suppression");
      setActionLoadingId(null);
      return;
    }

    setMessage("Membre supprimé avec succès");
    await reloadMembers();
    setActionLoadingId(null);
  }

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

    const confirmed = window.confirm(
      `Confirmer la suppression définitive de ${selectedMemberIds.length} membre(s) sélectionné(s) ? Cette action est irréversible.`,
    );
    if (!confirmed) return;

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
    await reloadMembers();
    setActionLoadingId(null);
  }

  function renderMemberRow(member: MemberWithGroups, selectable = false) {
    const isExpanded = expandedMemberIds.includes(member.id);

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
        <td className="data-table-primary px-4 py-3 font-medium text-foreground" data-label="Nom">
          {member.firstName} {member.lastName}
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
        <td className="px-4 py-3 text-right card-actions-cell mobile-detail-cell" data-label="Actions">
          <div className="flex items-center justify-end gap-2 card-actions-stack">
            <Link href={`/members/${member.id}`} className="btn btn-ghost min-h-0 px-2 py-1 text-xs">
              Détails
            </Link>
            <button
              type="button"
              onClick={() => archiveMember(member.id)}
              disabled={actionLoadingId === member.id || member.status === "ARCHIVED"}
              className="btn btn-danger min-h-0 px-2 py-1 text-xs"
            >
              {actionLoadingId === member.id ? "..." : "Résilier"}
            </button>
            <button
              type="button"
              onClick={() => deleteMember(member.id)}
              disabled={actionLoadingId === member.id}
              className="btn btn-danger min-h-0 px-2 py-1 text-xs"
              title="Suppression définitive"
            >
              {actionLoadingId === member.id ? "..." : "Supprimer"}
            </button>
          </div>
        </td>
        <td className="px-4 py-3 text-center sm:hidden mobile-toggle-cell">
          <button
            type="button"
            className="mobile-card-toggle"
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
      <div className="mb-4 grid gap-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="sm:min-w-48 sm:flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Recherche</label>
          <input
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              resetPagingAndSelection();
            }}
            placeholder="Nom, téléphone, email..."
            className="field w-full text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Statut</label>
          <select value={statusFilter} onChange={(e) => {
            setStatusFilter(e.target.value as typeof statusFilter);
            resetPagingAndSelection();
          }} className="field w-full text-xs sm:w-auto sm:min-w-32">
            <option value="ALL">Tous</option>
            <option value="ACTIVE">Actifs</option>
            <option value="ARCHIVED">Résiliés</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Paiement</label>
          <select value={paymentFilter} onChange={(e) => {
            setPaymentFilter(e.target.value as typeof paymentFilter);
            resetPagingAndSelection();
          }} className="field w-full text-xs sm:w-auto sm:min-w-40">
            <option value="ALL">Tous</option>
            <option value="PAID">Payé</option>
            <option value="PARTIAL">Partiel</option>
            <option value="UNPAID">Non payé</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Sport</label>
          <select value={sportFilter} onChange={(e) => {
            setSportFilter(e.target.value);
            resetPagingAndSelection();
          }} className="field w-full text-xs sm:w-auto sm:min-w-40">
            <option value="ALL">Tous</option>
            {sportsOptions.map((sport) => (
              <option key={sport.id} value={sport.id}>
                {sport.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Affichage</label>
          <select value={viewMode} onChange={(e) => {
            setViewMode(e.target.value as typeof viewMode);
            resetPagingAndSelection();
          }} className="field w-full text-xs sm:w-auto sm:min-w-40">
            <option value="LIST">Liste</option>
            <option value="GROUPED">Par groupe</option>
          </select>
        </div>
        <div className="sm:ml-auto">
          <Link href="/members/new" className="btn btn-primary btn-block-mobile inline-flex justify-center">
            + Ajouter un membre
          </Link>
        </div>
      </div>

      <FeedbackMessage message={message} className="mb-3" />

      {viewMode === "LIST" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {filteredMembers.length} membre(s) trouvé(s) · page {currentPageSafe}/{pageCount}
            </div>
            <div className="flex items-center gap-2">
              {selectedMemberIds.length > 0 ? (
                <>
                  <span className="text-xs font-medium text-muted-foreground">{selectedMemberIds.length} sélectionné(s)</span>
                  <button type="button" onClick={bulkDeleteSelectedMembers} disabled={actionLoadingId === "bulk-delete"} className="btn btn-danger px-3 py-2 text-xs">
                    {actionLoadingId === "bulk-delete" ? "Suppression..." : "Supprimer la sélection"}
                  </button>
                  <button type="button" onClick={() => setSelectedMemberIds([])} className="btn btn-ghost px-3 py-2 text-xs">
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
                  <th className="hidden px-4 py-3 text-right font-semibold sm:table-cell">Actions</th>
                  <th className="px-4 py-3 text-center sm:hidden font-semibold"> </th>
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

          {pageCount > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Affichage {pageMembers.length === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, filteredMembers.length)} sur {filteredMembers.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-ghost px-3 py-2 text-xs"
                  onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
                  disabled={currentPageSafe === 1}
                >
                  Précédent
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`rounded-lg px-3 py-2 text-xs font-medium transition ${pageNumber === currentPageSafe ? "bg-primary text-white" : "bg-(--surface-soft) text-foreground hover:bg-border"}`}
                    >
                      {pageNumber}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost px-3 py-2 text-xs"
                  onClick={() => setCurrentPage((current) => Math.min(pageCount, current + 1))}
                  disabled={currentPageSafe === pageCount}
                >
                  Suivant
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(groupedMembers.entries()).map(([groupId, rows]) => (
            <section key={groupId} className="rounded-xl border-border p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">{groupLabel(groupId)}</h3>
                <span className="text-xs text-muted-foreground">{rows.length} membre(s)</span>
              </div>
              <div className="mt-3 overflow-x-auto rounded-xl border-border">
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
    </div>
  );
}
