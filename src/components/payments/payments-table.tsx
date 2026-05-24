"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

type PaymentGroup = {
  subscriptionId: string;
  memberName: string;
  planName: string;
  totalDue: number;
  totalPaid: number;
  isComplete: boolean;
  payments: Array<{
    id: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string | null;
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
}: {
  paid: number;
  due: number;
  complete: boolean;
}) {
  const pct = progressPercent(paid, due);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--surface-soft)" role="presentation">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          complete ? "bg-[var(--success)]" : "bg-amber-500",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StatusChip({ complete, remaining }: { complete: boolean; remaining: number }) {
  if (complete) {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-700">
        Payé
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-800">
      Reste {formatCurrency(remaining)}
    </span>
  );
}

function PaymentInstallmentStatus({ status }: { status: string }) {
  if (status === "Paiement complet") {
    return (
      <span className="text-[0.65rem] font-medium text-emerald-700">{status}</span>
    );
  }
  if (status.startsWith("Avance")) {
    return <span className="text-[0.65rem] font-medium text-sky-700">{status}</span>;
  }
  return <span className="text-[0.65rem] font-medium text-amber-700">{status}</span>;
}

export function PaymentsTable({ groups }: PaymentsTableProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpand(subscriptionId: string) {
    setExpandedId((prev) => (prev === subscriptionId ? null : subscriptionId));
  }

  function goToAddPayment(subscriptionId: string) {
    router.push(`/payments/new?memberSubscriptionId=${subscriptionId}`);
  }

  function goToEditPayment(paymentId: string) {
    router.push(`/payments/${paymentId}/edit`);
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] p-6 text-center text-sm text-[var(--muted-foreground)]">
        Aucun paiement enregistré.
      </div>
    );
  }

  return (
    <>
      {/* Mobile: hierarchical subscription bars */}
      <ul className="space-y-2.5 md:hidden">
        {groups.map((group) => {
          const isOpen = expandedId === group.subscriptionId;
          const remaining = Math.max(0, group.totalDue - group.totalPaid);
          const installmentCount = group.payments.length;

          return (
            <li
              key={group.subscriptionId}
              className={cn(
                "overflow-hidden rounded-xl border bg-[var(--surface)] shadow-sm transition-shadow",
                group.isComplete ? "border-emerald-200/80" : "border-amber-200/80",
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
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-bold text-[var(--foreground)]">
                        {formatCurrency(group.totalPaid)}
                      </span>
                      <span className="block text-[0.65rem] text-[var(--muted-foreground)]">
                        / {formatCurrency(group.totalDue)}
                      </span>
                    </span>
                  </span>
                  <span className="mt-2 block">
                    <SubscriptionProgressBar paid={group.totalPaid} due={group.totalDue} complete={group.isComplete} />
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusChip complete={group.isComplete} remaining={remaining} />
                    <span className="text-[0.65rem] text-[var(--muted-foreground)]">
                      {installmentCount} versement{installmentCount > 1 ? "s" : ""}
                    </span>
                  </span>
                </span>
              </button>

              {isOpen ? (
                <div className="border-t border-[var(--border)] bg-[var(--surface-soft)]/50 px-3 pb-3 pt-2">
                  <ul className="space-y-1.5 border-l-2 border-[var(--primary)]/25 pl-3">
                    {group.payments.map((p, index) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 rounded-lg bg-[var(--surface)] px-2.5 py-2 text-left shadow-sm ring-1 ring-[var(--border)]/80 active:bg-[var(--surface-soft)]"
                          onClick={() => goToEditPayment(p.id)}
                        >
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-[var(--foreground)]">
                              Versement {group.payments.length - index}
                              <span className="font-normal text-[var(--muted-foreground)]">
                                {" "}
                                · {new Date(p.paymentDate).toLocaleDateString("fr-FR")}
                              </span>
                            </span>
                            <PaymentInstallmentStatus status={p.status} />
                          </span>
                          <span className="shrink-0 text-sm font-bold text-[var(--foreground)]">
                            {formatCurrency(p.amount)}
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
                  {!group.isComplete ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-block-mobile mt-2.5 min-h-11 flex items-center justify-center gap-1"
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

      {/* Desktop: table */}
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
              <th className="px-4 py-3 text-left font-semibold">Statut versement</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {groups.map((group) => {
              const isOpen = expandedId === group.subscriptionId;
              const hasMultiple = group.payments.length > 1;
              const remaining = Math.max(0, group.totalDue - group.totalPaid);

              return (
                <Fragment key={group.subscriptionId}>
                  <tr
                    className={cn(
                      "cursor-pointer transition-colors",
                      isOpen ? "bg-[var(--surface-soft)]" : "hover:bg-[var(--surface-soft)]",
                    )}
                    onClick={() => goToAddPayment(group.subscriptionId)}
                  >
                    <td className="px-4 py-3">
                      {hasMultiple ? (
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
                      <div className="mb-1.5 max-w-[10rem]">
                        <SubscriptionProgressBar
                          paid={group.totalPaid}
                          due={group.totalDue}
                          complete={group.isComplete}
                        />
                      </div>
                      {formatCurrency(group.totalPaid)}
                      <span className="font-normal text-[var(--muted-foreground)]"> / {formatCurrency(group.totalDue)}</span>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">—</td>
                    <td className="hidden px-4 py-3 md:table-cell">—</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusChip complete={group.isComplete} remaining={remaining} />
                        {!group.isComplete ? <Plus className="size-3.5 text-[var(--primary)]" /> : null}
                      </div>
                    </td>
                  </tr>

                  {isOpen
                    ? group.payments.map((p) => (
                        <tr
                          key={p.id}
                          className="cursor-pointer bg-[var(--surface-soft)]/40 transition-colors hover:bg-[var(--surface-soft)]"
                          onClick={() => goToEditPayment(p.id)}
                        >
                          <td className="px-4 py-2" />
                          <td className="px-4 py-2 pl-8 text-xs text-[var(--muted-foreground)]" colSpan={2}>
                            ↳ Versement · {new Date(p.paymentDate).toLocaleDateString("fr-FR")}
                          </td>
                          <td className="px-4 py-2 font-medium text-[var(--foreground)]">{formatCurrency(p.amount)}</td>
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
    </>
  );
}
