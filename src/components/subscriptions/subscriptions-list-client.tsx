"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CreditCard, RotateCcw } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FilterField,
  ListSearch,
  MobileFilterSheet,
  MobileFiltersButton,
} from "@/components/ui/list-controls";
import { buildSubscriptionBillingView, formatMoney } from "@/lib/subscription-billing";
import {
  DataTable,
  DataTableBody,
  DataTableHead,
  DataTableRow,
  MobileRowToggle,
  TableActionsCell,
  Td,
  Th,
} from "@/components/ui/responsive-table";
import type { SubscriptionStatus } from "@prisma/client";
import { Pagination, usePagination } from "@/components/ui/pagination";

export type SubscriptionRow = {
  id: string;
  memberName: string;
  memberPhone: string;
  planName: string;
  amount: number;
  listPriceCents: number | null;
  discountCents: number;
  offerName: string | null;
  startDate: string;
  endDate: string | null;
  status: SubscriptionStatus;
  totalPaid: number;
  remainingSessions: number;
  totalSessions: number;
  createdAt: string;
};

function statusVariant(status: SubscriptionStatus) {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "DRAFT":
      return "info";
    case "EXPIRED":
      return "warning";
    case "CANCELLED":
      return "danger";
    default:
      return "muted";
  }
}

function statusLabel(status: SubscriptionStatus) {
  switch (status) {
    case "ACTIVE":
      return "Actif";
    case "DRAFT":
      return "Brouillon";
    case "EXPIRED":
      return "Expiré";
    case "CANCELLED":
      return "Résilié";
    default:
      return status;
  }
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

export function SubscriptionsListClient({ subscriptions }: { subscriptions: SubscriptionRow[] }) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | SubscriptionStatus>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | "PAID" | "OPEN">("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filteredSubscriptions = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase("fr");
    return subscriptions.filter((subscription) => {
      const matchesSearch =
        !query ||
        subscription.memberName.toLocaleLowerCase("fr").includes(query) ||
        subscription.memberPhone.toLocaleLowerCase("fr").includes(query) ||
        subscription.planName.toLocaleLowerCase("fr").includes(query);
      const matchesStatus = statusFilter === "ALL" || subscription.status === statusFilter;
      const matchesPayment =
        paymentFilter === "ALL" ||
        (paymentFilter === "PAID"
          ? subscription.totalPaid >= subscription.amount
          : subscription.totalPaid < subscription.amount);
      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [paymentFilter, searchTerm, statusFilter, subscriptions]);

  const activeFilterCount = [statusFilter !== "ALL", paymentFilter !== "ALL"].filter(Boolean).length;
  const pagination = usePagination(
    filteredSubscriptions,
    20,
    `${searchTerm}|${statusFilter}|${paymentFilter}`,
  );

  function resetFilters() {
    setStatusFilter("ALL");
    setPaymentFilter("ALL");
  }

  function toggle(id: string) {
    setExpandedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
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
            placeholder="Membre, téléphone ou formule..."
          />
        </div>
        <MobileFiltersButton onClick={() => setFiltersOpen(true)} count={activeFilterCount} />
        <div className="hidden grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_auto] gap-2 md:grid">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="field text-xs"
            aria-label="Statut de l'abonnement"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="ACTIVE">Actifs</option>
            <option value="DRAFT">Brouillons</option>
            <option value="EXPIRED">Expirés</option>
            <option value="CANCELLED">Résiliés</option>
          </select>
          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value as typeof paymentFilter)}
            className="field text-xs"
            aria-label="État du paiement"
          >
            <option value="ALL">Tous les paiements</option>
            <option value="OPEN">Solde restant</option>
            <option value="PAID">Soldés</option>
          </select>
          {activeFilterCount > 0 ? (
            <button type="button" onClick={resetFilters} className="btn btn-ghost shrink-0 px-3" title="Réinitialiser">
              <RotateCcw className="size-4" />
            </button>
          ) : <span />}
        </div>
      </div>
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        {filteredSubscriptions.length} abonnement{filteredSubscriptions.length > 1 ? "s" : ""} affiché{filteredSubscriptions.length > 1 ? "s" : ""}
      </p>
    </div>

    {filteredSubscriptions.length === 0 ? (
      <EmptyState
        icon={<CreditCard className="size-8 opacity-45" />}
        title={subscriptions.length === 0 ? "Aucun abonnement" : "Aucun résultat"}
        message={
          subscriptions.length === 0
            ? "Les abonnements membres apparaîtront ici."
            : "Modifiez la recherche ou réinitialisez les filtres."
        }
        action={
          subscriptions.length === 0 ? (
            <Link href="/subscriptions/new" className="btn btn-primary">Créer un abonnement</Link>
          ) : (
            <button type="button" onClick={() => { setSearchTerm(""); resetFilters(); }} className="btn btn-ghost">
              Réinitialiser
            </button>
          )
        }
      />
    ) : (
    <DataTable>
      <DataTableHead>
        <tr>
          <Th className="min-w-[11rem] whitespace-nowrap">Membre</Th>
          <Th className="min-w-[14rem] whitespace-nowrap">Plan</Th>
          <Th className="hidden min-w-[7rem] whitespace-nowrap sm:table-cell">Montant</Th>
          <Th className="hidden min-w-[7rem] whitespace-nowrap md:table-cell">Début</Th>
          <Th className="hidden min-w-[7rem] whitespace-nowrap md:table-cell">Fin</Th>
          <Th className="hidden min-w-[9rem] whitespace-nowrap lg:table-cell">Payé</Th>
          <Th className="min-w-[7rem] whitespace-nowrap">Statut</Th>
          <Th className="hidden min-w-[6rem] whitespace-nowrap text-center sm:table-cell">Séances</Th>
          <Th className="hidden text-right md:table-cell">Actions</Th>
          <Th className="px-2 text-center md:hidden"> </Th>
        </tr>
      </DataTableHead>
      <DataTableBody>
        {pagination.pageItems.map((sub) => {
          const isExpanded = expandedIds.includes(sub.id);
          const billing = buildSubscriptionBillingView({
            amount: sub.amount,
            totalPaid: sub.totalPaid,
            listPriceCents: sub.listPriceCents,
            discountCents: sub.discountCents,
            offerName: sub.offerName,
          });
          return (
            <DataTableRow key={sub.id} expanded={isExpanded}>
              <Td label="Membre" primary className="min-w-[11rem] whitespace-nowrap font-medium">
                {sub.memberName}
                <p className="text-xs text-muted-foreground">{sub.memberPhone}</p>
              </Td>
              <Td label="Plan" mobileDetail className="min-w-[14rem] whitespace-nowrap">
                {sub.planName}
                {billing.offerRemark ? (
                  <p className="mt-0.5 text-[0.65rem] leading-snug text-emerald-700">{billing.offerRemark}</p>
                ) : null}
              </Td>
              <Td label="Montant" className="hidden whitespace-nowrap sm:table-cell">
                {formatMoney(sub.amount)}
                {billing.hasOfferDiscount && billing.listPriceCents > sub.amount ? (
                  <span className="ml-1 text-xs text-muted-foreground line-through">
                    {formatMoney(billing.listPriceCents)}
                  </span>
                ) : null}
              </Td>
              <Td label="Début" mobileDetail className="hidden whitespace-nowrap md:table-cell">
                {formatDate(sub.startDate)}
              </Td>
              <Td label="Fin" mobileDetail className="hidden whitespace-nowrap md:table-cell">
                {formatDate(sub.endDate)}
              </Td>
              <Td label="Payé" mobileDetail className="hidden whitespace-nowrap lg:table-cell">
                <span
                  className={
                    billing.isComplete
                      ? "font-semibold text-[var(--success)]"
                      : "font-semibold text-amber-700"
                  }
                >
                  {formatMoney(billing.totalPaid)}
                </span>
                <span className="text-xs text-muted-foreground"> / {formatMoney(billing.amountDue)}</span>
              </Td>
              <Td label="Statut" className="whitespace-nowrap">
                <StatusBadge variant={statusVariant(sub.status)}>{statusLabel(sub.status)}</StatusBadge>
              </Td>
              <Td label="Séances" mobileDetail className="hidden whitespace-nowrap text-center sm:table-cell">
                <span className={sub.remainingSessions > 0 ? "text-[var(--primary)]" : "text-[var(--danger)]"}>
                  {sub.remainingSessions} / {sub.totalSessions}
                </span>
              </Td>
              <Td label="Montant" mobileDetail className="md:hidden">
                {formatMoney(sub.amount)}
                {billing.offerRemark ? (
                  <p className="mt-0.5 text-[0.65rem] text-emerald-700">{billing.offerRemark}</p>
                ) : null}
              </Td>
              <Td label="Payé" mobileDetail className="md:hidden">
                <span className={billing.isComplete ? "text-[var(--success)]" : "text-amber-700"}>
                  {formatMoney(billing.totalPaid)}
                </span>
                <span className="text-xs text-muted-foreground"> / {formatMoney(billing.amountDue)}</span>
              </Td>
              <Td label="Séances" mobileDetail className="md:hidden">
                {sub.remainingSessions} / {sub.totalSessions}
              </Td>
              <TableActionsCell>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  {sub.status === "ACTIVE" && sub.totalPaid < sub.amount ? (
                    <Link
                      href={`/payments/new?memberSubscriptionId=${sub.id}`}
                      className="btn btn-primary btn-block-mobile min-h-11 sm:w-auto"
                    >
                      Encaisser
                    </Link>
                  ) : null}
                  <Link href={`/subscriptions/${sub.id}/edit`} className="btn btn-ghost btn-block-mobile min-h-11 sm:w-auto">
                    Modifier
                  </Link>
                </div>
              </TableActionsCell>
              <MobileRowToggle expanded={isExpanded} onToggle={() => toggle(sub.id)} />
            </DataTableRow>
          );
        })}
      </DataTableBody>
    </DataTable>
    )}

    <Pagination
      currentPage={pagination.currentPage}
      pageCount={pagination.pageCount}
      totalItems={filteredSubscriptions.length}
      onPageChange={pagination.setPage}
    />

    <MobileFilterSheet
      open={filtersOpen}
      onClose={() => setFiltersOpen(false)}
      onReset={resetFilters}
      activeCount={activeFilterCount}
      resultCount={filteredSubscriptions.length}
      title="Filtrer les abonnements"
    >
      <FilterField label="Statut">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          className="field"
        >
          <option value="ALL">Tous les statuts</option>
          <option value="ACTIVE">Actifs</option>
          <option value="DRAFT">Brouillons</option>
          <option value="EXPIRED">Expirés</option>
          <option value="CANCELLED">Résiliés</option>
        </select>
      </FilterField>
      <FilterField label="Paiement">
        <select
          value={paymentFilter}
          onChange={(event) => setPaymentFilter(event.target.value as typeof paymentFilter)}
          className="field"
        >
          <option value="ALL">Tous les paiements</option>
          <option value="OPEN">Solde restant</option>
          <option value="PAID">Soldés</option>
        </select>
      </FilterField>
    </MobileFilterSheet>
    </>
  );
}
