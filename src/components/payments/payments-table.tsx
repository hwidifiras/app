"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";

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

export function PaymentsTable({ groups }: PaymentsTableProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(subscriptionId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(subscriptionId)) {
        next.delete(subscriptionId);
      } else {
        next.add(subscriptionId);
      }
      return next;
    });
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
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
          <tr>
            <th className="px-4 py-3 text-left font-semibold w-10"></th>
            <th className="px-4 py-3 text-left font-semibold">Membre</th>
            <th className="px-4 py-3 text-left font-semibold">Plan</th>
            <th className="px-4 py-3 text-left font-semibold">Montant</th>
            <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">Date</th>
            <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Méthode</th>
            <th className="px-4 py-3 text-left font-semibold">Statut versement</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {groups.map((group) => {
            const isOpen = expanded.has(group.subscriptionId);
            const hasMultiple = group.payments.length > 1;

            return (
              <Fragment key={group.subscriptionId}>
                {/* Ligne parente : clic → ajouter un paiement */}
                <tr
                  className={`cursor-pointer transition-colors ${isOpen ? "bg-[var(--surface-soft)]" : "hover:bg-[var(--surface-soft)]"}`}
                  onClick={() => goToAddPayment(group.subscriptionId)}
                >
                  <td className="px-4 py-3">
                    {hasMultiple ? (
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded p-0.5 hover:bg-[var(--border)]"
                        onClick={(e) => toggle(group.subscriptionId, e)}
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
                    {formatCurrency(group.totalPaid)}
                    <span className="text-[var(--muted-foreground)] font-normal">
                      {" "}
                      / {formatCurrency(group.totalDue)}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">—</td>
                  <td className="px-4 py-3 hidden md:table-cell">—</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {group.isComplete ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                          Payé
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          Partiel — reste {formatCurrency(group.totalDue - group.totalPaid)}
                        </span>
                      )}
                      {!group.isComplete && (
                        <Plus className="size-3.5 text-[var(--primary)]" />
                      )}
                    </div>
                  </td>
                </tr>

                {/* Sous-lignes : clic → éditer le paiement */}
                {isOpen &&
                  group.payments.map((p) => (
                    <tr
                      key={p.id}
                      className="cursor-pointer hover:bg-[var(--surface-soft)] transition-colors"
                      onClick={() => goToEditPayment(p.id)}
                    >
                      <td className="px-4 py-2" />
                      <td className="px-4 py-2 text-[var(--muted-foreground)]">—</td>
                      <td className="px-4 py-2">
                        <span className="sm:hidden text-xs text-[var(--muted-foreground)]">
                          {new Date(p.paymentDate).toLocaleDateString("fr-FR")}
                          {p.paymentMethod ? ` · ${p.paymentMethod}` : ""}
                        </span>
                        <span className="hidden sm:inline text-[var(--muted-foreground)]">—</span>
                      </td>
                      <td className="px-4 py-2 font-medium text-[var(--foreground)]">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-2 hidden sm:table-cell">
                        {new Date(p.paymentDate).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-4 py-2 hidden md:table-cell">{p.paymentMethod ?? "—"}</td>
                      <td className="px-4 py-2">
                        {p.status === "Paiement complet" ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            {p.status}
                          </span>
                        ) : p.status.startsWith("Avance") ? (
                          <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                            {p.status}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            {p.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
