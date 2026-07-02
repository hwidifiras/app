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

type OperationalMode = "TO_COLLECT" | "TO_RENEW" | "ACTIVE" | "ALL";

const RENEWAL_WINDOW_DAYS = 7;
const LOW_SESSION_THRESHOLD = 2;

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

function remainingCents(subscription: SubscriptionRow) {
  return Math.max(0, subscription.amount - subscription.totalPaid);
}

function daysUntilEnd(subscription: SubscriptionRow) {
  if (!subscription.endDate) return Number.POSITIVE_INFINITY;
  const now = new Date();
  const end = new Date(subscription.endDate);
  return Math.ceil((end.getTime() - now.getTime()) / 86_400_000);
}

function needsRenewal(subscription: SubscriptionRow) {
  if (subscription.status !== "ACTIVE") return false;
  return daysUntilEnd(subscription) <= RENEWAL_WINDOW_DAYS || subscription.remainingSessions <= LOW_SESSION_THRESHOLD;
}

function chooseInitialMode(subscriptions: SubscriptionRow[]): OperationalMode {
  if (subscriptions.some((subscription) => remainingCents(subscription) > 0)) return "TO_COLLECT";
  if (subscriptions.some(needsRenewal)) return "TO_RENEW";
  return "ACTIVE";
}

const OPERATIONAL_MODES: Array<{ id: OperationalMode; label: string }> = [
  { id: "TO_COLLECT", label: "À encaisser" },
  { id: "TO_RENEW", label: "À renouveler" },
  { id: "ACTIVE", label: "Actifs" },
  { id: "ALL", label: "Tous" },
];

export function SubscriptionsListClient({ subscriptions }: { subscriptions: SubscriptionRow[] }) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | SubscriptionStatus>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | "PAID" | "OPEN">("ALL");
  const [operationalMode, setOperationalMode] = useState<OperationalMode>(() => chooseInitialMode(subscriptions));
  const [filtersOpen, setFiltersOpen] = useState(false);

  const operationalCounts = useMemo(
    () => ({
      TO_COLLECT: subscriptions.filter((subscription) => remainingCents(subscription) > 0).length,
      TO_RENEW: subscriptions.filter(needsRenewal).length,
      ACTIVE: subscriptions.filter((subscription) => subscription.status === "ACTIVE").length,
      ALL: subscriptions.length,
    }),
    [subscriptions],
  );

  const filteredSubscriptions = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase("fr");
    return subscriptions.filter((subscription) => {
      const matchesOperationalMode =
        operationalMode === "ALL" ||
        (operationalMode === "TO_COLLECT" && remainingCents(subscription) > 0) ||
        (operationalMode === "TO_RENEW" && needsRenewal(subscription)) ||
        (operationalMode === "ACTIVE" && subscription.status === "ACTIVE");
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
      return matchesOperationalMode && matchesSearch && matchesStatus && matchesPayment;
    }).sort((a, b) => {
      const remainingDelta = remainingCents(b) - remainingCents(a);
      if (remainingDelta !== 0) return remainingDelta;
      const dayDelta = daysUntilEnd(a) - daysUntilEnd(b);
      if (dayDelta !== 0) return dayDelta;
      return a.remainingSessions - b.remainingSessions;
    });
  }, [operationalMode, paymentFilter, searchTerm, statusFilter, subscriptions]);

  const activeFilterCount = [statusFilter !== "ALL", paymentFilter !== "ALL"].filter(Boolean).length;
  const pagination = usePagination(
    filteredSubscriptions,
    20,
    `${operationalMode}|${searchTerm}|${statusFilter}|${paymentFilter}`,
  );

  function resetFilters() {
    setStatusFilter("ALL");
    setPaymentFilter("ALL");
  }

  function resetAll() {
    setSearchTerm("");
    resetFilters();
    setOperationalMode(chooseInitialMode(subscriptions));
  }

  function toggle(id: string) {
    setExpandedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  return (
    <>
    <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
      {OPERATIONAL_MODES.map((mode) => {
        const active = mode.id === operationalMode;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => setOperationalMode(mode.id)}
            className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
              active
                ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--foreground)] hover:border-[var(--primary)]/35"
            }`}
            aria-pressed={active}
          >
            {mode.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[0.65rem] ${active ? "bg-white/18 text-white" : "bg-[var(--surface)] text-[var(--muted-foreground)]"}`}>
              {operationalCounts[mode.id]}
            </span>
          </button>
        );
      })}
    </div>
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
            <button type="button" onClick={resetAll} className="btn btn-ghost">
              Réinitialiser
            </button>
          )
        }
      />
    ) : (
    <DataTable>
      <DataTableHead>
        <tr>
          <Th className="min-w-[10rem] whitespace-nowrap">Membre</Th>
          <Th className="min-w-[13rem] whitespace-nowrap">Formule</Th>
          <Th className="min-w-[9rem] whitespace-nowrap">Payé / reste</Th>
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
              <Td label="Membre" primary className="min-w-[10rem] font-medium">
                {sub.memberName}
                <p className="text-xs text-muted-foreground">{sub.memberPhone}</p>
              </Td>
              <Td label="Formule" mobileDetail className="min-w-[13rem]">
                <span className="font-medium">{sub.planName}</span>
                <p className="mt-0.5 text-[0.68rem] leading-snug text-muted-foreground">
                  {formatMoney(sub.amount)} · {formatDate(sub.startDate)} → {formatDate(sub.endDate)}
                </p>
                {billing.offerRemark ? (
                  <p className="mt-0.5 text-[0.65rem] leading-snug text-emerald-700">{billing.offerRemark}</p>
                ) : null}
              </Td>
              <Td label="Payé / reste" className="whitespace-nowrap">
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
                {billing.hasOfferDiscount && billing.listPriceCents > sub.amount ? (
                  <span className="block text-[0.65rem] text-muted-foreground line-through">
                    Base {formatMoney(billing.listPriceCents)}
                  </span>
                ) : null}
              </Td>
              <Td label="Statut" className="whitespace-nowrap">
                <StatusBadge variant={statusVariant(sub.status)}>{statusLabel(sub.status)}</StatusBadge>
              </Td>
              <Td label="Séances" mobileDetail className="hidden whitespace-nowrap text-center sm:table-cell">
                <span className={sub.remainingSessions > 0 ? "text-[var(--primary)]" : "text-[var(--danger)]"}>
                  {sub.remainingSessions} / {sub.totalSessions}
                </span>
              </Td>
              <Td label="Séances" mobileDetail className="md:hidden">
                {sub.remainingSessions} / {sub.totalSessions}
              </Td>
              <TableActionsCell>
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
