"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, ChevronDown, ChevronRight, Plus, RotateCcw } from "lucide-react";

import { buildSubscriptionBillingView, formatMoney } from "@/lib/subscription-billing";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FilterField,
  ListSearch,
  MobileFilterSheet,
  MobileFiltersButton,
} from "@/components/ui/list-controls";
import { Pagination, usePagination } from "@/components/ui/pagination";

type PaymentGroup = {
  subscriptionId: string;
  memberName: string;
  planName: string;
  totalDue: number;
  totalPaid: number;
  listPriceCents: number | null;
  discountCents: number;
  offerName: string | null;
  isComplete: boolean;
  payments: Array<{
    id: string;
    amount: number;
    paymentDate: string;
    createdAt: string;
    paymentMethod: string | null;
    entryType: "PAYMENT" | "CORRECTION" | "REVERSAL";
    correctionReason: string | null;
    sequence: number;
    status: string;
  }>;
};

type PaymentsTableProps = {
  groups: PaymentGroup[];
};

function progressPercent(paid: number, due: number) {
  if (due <= 0) return 100;
  return Math.min(100, Math.round((paid / due) * 100));
}

function SubscriptionProgressBar({
  paid,
  due,
  complete,
  hasOffer,
}: {
  paid: number;
  due: number;
  complete: boolean;
  hasOffer: boolean;
}) {
  const pct = progressPercent(paid, due);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]" role="presentation">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          complete ? "bg-[var(--success)]" : hasOffer ? "bg-sky-500" : "bg-amber-500",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StatusChip({
  statusLabel,
  statusTone,
}: {
  statusLabel: string;
  statusTone: "success" | "warning" | "muted";
}) {
  const classes =
    statusTone === "success"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
      : statusTone === "warning"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        : "bg-[var(--surface-soft)] text-[var(--muted-foreground)]";

  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold", classes)}>
      {statusLabel}
    </span>
  );
}

function OfferRemark({ remark }: { remark: string | null }) {
  if (!remark) return null;
  return (
    <p className="mt-1 text-[0.65rem] leading-snug text-emerald-800 dark:text-emerald-200">{remark}</p>
  );
}

function PaymentInstallmentStatus({ status }: { status: string }) {
  if (status === "Paiement complet") {
    return <span className="text-[0.65rem] font-medium text-emerald-700">{status}</span>;
  }
  if (status.startsWith("Correction") || status.startsWith("Annulation")) {
    return <span className="text-[0.65rem] font-medium text-violet-700">{status}</span>;
  }
  if (status.startsWith("Avance")) {
    return <span className="text-[0.65rem] font-medium text-sky-700">{status}</span>;
  }
  return <span className="text-[0.65rem] font-medium text-amber-700">{status}</span>;
}

function ledgerTypeLabel(entryType: PaymentGroup["payments"][number]["entryType"]) {
  if (entryType === "CORRECTION") return "Correction";
  if (entryType === "REVERSAL") return "Annulation";
  return "Paiement";
}

function AmountSummary({ group }: { group: PaymentGroup }) {
  const billing = buildSubscriptionBillingView({
    amount: group.totalDue,
    totalPaid: group.totalPaid,
    listPriceCents: group.listPriceCents,
    discountCents: group.discountCents,
    offerName: group.offerName,
  });

  return (
    <span className="shrink-0 text-right">
      <span
        className={cn(
          "block text-sm font-bold tabular-nums",
          billing.isComplete ? "text-emerald-700 dark:text-emerald-300" : "text-[var(--foreground)]",
        )}
      >
        {formatMoney(billing.totalPaid)}
      </span>
      <span className="block text-[0.65rem] tabular-nums text-[var(--muted-foreground)]">
        / {formatMoney(billing.amountDue)}
        {billing.hasOfferDiscount && billing.listPriceCents > billing.amountDue ? (
          <span className="ml-1 line-through opacity-70">{formatMoney(billing.listPriceCents)}</span>
        ) : null}
      </span>
      <OfferRemark remark={billing.offerRemark} />
    </span>
  );
}

export function PaymentsTable({ groups }: PaymentsTableProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | "COMPLETE" | "OPEN">("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filteredGroups = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase("fr");
    return groups.filter((group) => {
      const matchesSearch =
        !query ||
        group.memberName.toLocaleLowerCase("fr").includes(query) ||
        group.planName.toLocaleLowerCase("fr").includes(query) ||
        (group.offerName?.toLocaleLowerCase("fr").includes(query) ?? false);
      const matchesPayment =
        paymentFilter === "ALL" ||
        (paymentFilter === "COMPLETE" ? group.isComplete : !group.isComplete);
      return matchesSearch && matchesPayment;
    });
  }, [groups, paymentFilter, searchTerm]);

  const activeFilterCount = paymentFilter === "ALL" ? 0 : 1;
  const pagination = usePagination(filteredGroups, 20, `${searchTerm}|${paymentFilter}`);

  function resetFilters() {
    setPaymentFilter("ALL");
  }

  function toggleExpand(subscriptionId: string) {
    setExpandedId((prev) => (prev === subscriptionId ? null : subscriptionId));
  }

  function goToAddPayment(subscriptionId: string) {
    router.push(`/payments/new?memberSubscriptionId=${subscriptionId}`);
  }

  function goToEditPayment(paymentId: string) {
    router.push(`/payments/${paymentId}/edit`);
  }

  return (
    <>
      <div className="sticky top-[57px] z-20 -mx-2 mb-4 border-b border-[var(--border)] bg-[var(--surface)]/96 px-2 pb-3 pt-1 backdrop-blur lg:top-[3.5rem]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Recherche</label>
            <ListSearch
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Membre, formule ou offre..."
            />
          </div>
          <MobileFiltersButton onClick={() => setFiltersOpen(true)} count={activeFilterCount} />
          <div className="hidden min-w-48 md:block">
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">État du paiement</label>
            <div className="flex gap-2">
              <select
                value={paymentFilter}
                onChange={(event) => setPaymentFilter(event.target.value as typeof paymentFilter)}
                className="field text-xs"
              >
                <option value="ALL">Tous</option>
                <option value="OPEN">Solde restant</option>
                <option value="COMPLETE">Soldés</option>
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
          {filteredGroups.length} abonnement{filteredGroups.length > 1 ? "s" : ""} affiché{filteredGroups.length > 1 ? "s" : ""}
        </p>
      </div>

      {filteredGroups.length === 0 ? (
        <EmptyState
          icon={<Banknote className="size-8 opacity-45" />}
          title={groups.length === 0 ? "Aucun paiement" : "Aucun résultat"}
          message={
            groups.length === 0
              ? "Les encaissements apparaîtront ici après leur enregistrement."
              : "Modifiez la recherche ou réinitialisez les filtres."
          }
          action={
            groups.length === 0 ? (
              <button type="button" onClick={() => router.push("/payments/new")} className="btn btn-primary">
                Nouveau paiement
              </button>
            ) : (
              <button type="button" onClick={() => { setSearchTerm(""); resetFilters(); }} className="btn btn-ghost">
                Réinitialiser
              </button>
            )
          }
        />
      ) : (
      <>
      <ul className="space-y-2.5 md:hidden">
        {pagination.pageItems.map((group) => {
          const billing = buildSubscriptionBillingView({
            amount: group.totalDue,
            totalPaid: group.totalPaid,
            listPriceCents: group.listPriceCents,
            discountCents: group.discountCents,
            offerName: group.offerName,
          });
          const isOpen = expandedId === group.subscriptionId;
          const installmentCount = group.payments.length;

          return (
            <li
              key={group.subscriptionId}
              className={cn(
                "overflow-hidden rounded-xl border bg-[var(--surface)] shadow-sm transition-shadow",
                billing.isComplete ? "border-emerald-200/80" : "border-amber-200/80",
              )}
            >
              <button
                type="button"
                className="flex w-full items-start gap-2.5 px-3 py-3 text-left"
                onClick={() => toggleExpand(group.subscriptionId)}
                aria-expanded={isOpen}
              >
                <span className="mt-0.5 shrink-0 text-[var(--muted-foreground)]">
                  {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[var(--foreground)]">
                        {group.memberName}
                      </span>
                      <span className="block truncate text-xs text-[var(--muted-foreground)]">{group.planName}</span>
                    </span>
                    <AmountSummary group={group} />
                  </span>
                  <span className="mt-2 block">
                    <SubscriptionProgressBar
                      paid={billing.totalPaid}
                      due={billing.amountDue}
                      complete={billing.isComplete}
                      hasOffer={billing.hasOfferDiscount}
                    />
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusChip statusLabel={billing.statusLabel} statusTone={billing.statusTone} />
                    <span className="text-[0.65rem] text-[var(--muted-foreground)]">
                      {installmentCount} versement{installmentCount > 1 ? "s" : ""}
                    </span>
                  </span>
                </span>
              </button>

              {isOpen ? (
                <div className="border-t border-[var(--border)] bg-[var(--surface-soft)] px-3 pb-3 pt-2">
                  <ul className="space-y-1.5 border-l-2 border-[var(--primary)]/25 pl-3">
                    {group.payments.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 rounded-lg bg-[var(--surface)] px-2.5 py-2 text-left shadow-sm ring-1 ring-[var(--border)] active:bg-[var(--surface-soft)]"
                          onClick={() => goToEditPayment(p.id)}
                        >
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-[var(--foreground)]">
                              {ledgerTypeLabel(p.entryType)} {p.entryType === "PAYMENT" ? p.sequence : ""}
                              <span className="font-normal text-[var(--muted-foreground)]">
                                {" "}
                                · {new Date(p.paymentDate).toLocaleDateString("fr-FR")}
                              </span>
                            </span>
                            <PaymentInstallmentStatus status={p.status} />
                            {p.correctionReason ? (
                              <span className="mt-0.5 block text-[0.6rem] text-[var(--muted-foreground)]">
                                Motif: {p.correctionReason}
                              </span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-sm font-bold text-[var(--foreground)]">
                            {formatMoney(p.amount)}
                          </span>
                        </button>
                        {p.paymentMethod ? (
                          <p className="mt-0.5 pl-2.5 text-[0.6rem] uppercase tracking-wide text-[var(--muted-foreground)]">
                            {p.paymentMethod}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {!billing.isComplete ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-block-mobile mt-2.5 flex min-h-11 items-center justify-center gap-1"
                      onClick={() => goToAddPayment(group.subscriptionId)}
                    >
                      <Plus className="size-3.5" />
                      Ajouter un versement
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="data-table hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
            <tr>
              <th className="w-10 px-4 py-3 text-left font-semibold" />
              <th className="px-4 py-3 text-left font-semibold">Membre</th>
              <th className="px-4 py-3 text-left font-semibold">Plan</th>
              <th className="px-4 py-3 text-left font-semibold">Montant</th>
              <th className="hidden px-4 py-3 text-left font-semibold sm:table-cell">Date</th>
              <th className="hidden px-4 py-3 text-left font-semibold md:table-cell">Méthode</th>
              <th className="px-4 py-3 text-left font-semibold">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {pagination.pageItems.map((group) => {
              const billing = buildSubscriptionBillingView({
                amount: group.totalDue,
                totalPaid: group.totalPaid,
                listPriceCents: group.listPriceCents,
                discountCents: group.discountCents,
                offerName: group.offerName,
              });
              const isOpen = expandedId === group.subscriptionId;
              const hasLedgerRows = group.payments.length > 0;
              const latestPayment = group.payments[0];

              return (
                <Fragment key={group.subscriptionId}>
                  <tr
                    className={cn(
                      "cursor-pointer transition-colors",
                      isOpen ? "bg-[var(--surface-soft)]" : "hover:bg-[var(--surface-soft)]",
                    )}
                    onClick={() => toggleExpand(group.subscriptionId)}
                  >
                    <td className="px-4 py-3">
                      {hasLedgerRows ? (
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded p-0.5 hover:bg-[var(--border)]"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(group.subscriptionId);
                          }}
                          title={isOpen ? "Replier" : "Déplier"}
                        >
                          {isOpen ? (
                            <ChevronDown className="size-4 text-[var(--muted-foreground)]" />
                          ) : (
                            <ChevronRight className="size-4 text-[var(--muted-foreground)]" />
                          )}
                        </button>
                      ) : (
                        <span className="inline-block size-4" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{group.memberName}</td>
                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">{group.planName}</td>
                    <td className="px-4 py-3 font-semibold text-[var(--foreground)]">
                      <div className="mb-1.5 max-w-[12rem]">
                        <SubscriptionProgressBar
                          paid={billing.totalPaid}
                          due={billing.amountDue}
                          complete={billing.isComplete}
                          hasOffer={billing.hasOfferDiscount}
                        />
                      </div>
                      <span className={billing.isComplete ? "text-emerald-700" : undefined}>
                        {formatMoney(billing.totalPaid)}
                      </span>
                      <span className="font-normal text-[var(--muted-foreground)]">
                        {" "}
                        / {formatMoney(billing.amountDue)}
                      </span>
                      <OfferRemark remark={billing.offerRemark} />
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      {latestPayment ? new Date(latestPayment.paymentDate).toLocaleDateString("fr-FR") : "—"}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">{latestPayment?.paymentMethod ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusChip statusLabel={billing.statusLabel} statusTone={billing.statusTone} />
                        {!billing.isComplete ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              goToAddPayment(group.subscriptionId);
                            }}
                            className="inline-flex size-7 items-center justify-center rounded-md text-[var(--primary)] hover:bg-[var(--surface-soft)]"
                            title="Ajouter un versement"
                            aria-label="Ajouter un versement"
                          >
                            <Plus className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>

                  {isOpen
                    ? group.payments.map((p) => (
                        <tr
                          key={p.id}
                          className="cursor-pointer bg-[var(--surface-soft)] transition-colors hover:bg-[var(--surface-soft)]"
                          onClick={() => goToEditPayment(p.id)}
                        >
                          <td className="px-4 py-2" />
                          <td className="px-4 py-2 pl-8 text-xs text-[var(--muted-foreground)]" colSpan={2}>
                            ↳ {ledgerTypeLabel(p.entryType)} {p.entryType === "PAYMENT" ? p.sequence : ""} · {new Date(p.paymentDate).toLocaleDateString("fr-FR")}
                            {p.correctionReason ? (
                              <span className="mt-0.5 block">Motif: {p.correctionReason}</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-2 font-medium text-[var(--foreground)]">{formatMoney(p.amount)}</td>
                          <td className="hidden px-4 py-2 sm:table-cell">
                            {new Date(p.paymentDate).toLocaleDateString("fr-FR")}
                          </td>
                          <td className="hidden px-4 py-2 md:table-cell">{p.paymentMethod ?? "—"}</td>
                          <td className="px-4 py-2">
                            <PaymentInstallmentStatus status={p.status} />
                          </td>
                        </tr>
                      ))
                    : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination
        currentPage={pagination.currentPage}
        pageCount={pagination.pageCount}
        totalItems={filteredGroups.length}
        onPageChange={pagination.setPage}
      />
      </>
      )}

      <MobileFilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onReset={resetFilters}
        activeCount={activeFilterCount}
        resultCount={filteredGroups.length}
        title="Filtrer les paiements"
      >
        <FilterField label="État du paiement">
          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value as typeof paymentFilter)}
            className="field"
          >
            <option value="ALL">Tous</option>
            <option value="OPEN">Solde restant</option>
            <option value="COMPLETE">Soldés</option>
          </select>
        </FilterField>
      </MobileFilterSheet>
    </>
  );
}
