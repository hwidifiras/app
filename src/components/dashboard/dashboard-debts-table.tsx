"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type DebtRow = {
  memberId: string;
  memberName: string;
  phone: string;
  totalDebt: number;
  subscriptions: number;
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function DashboardDebtsTable({ debts }: { debts: DebtRow[] }) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  function toggleExpand(memberId: string) {
    setExpandedIds((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId],
    );
  }

  return (
    <div className="data-table overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Membre</th>
            <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Telephone</th>
            <th className="px-4 py-3 text-right font-semibold">Montant</th>
            <th className="px-4 py-3 text-right font-semibold hidden md:table-cell">Dossiers</th>
            <th className="px-4 py-3 text-center font-semibold md:hidden" aria-hidden="true">
              <span className="sr-only">Détails</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {debts.map((item) => {
            const expanded = expandedIds.includes(item.memberId);
            return (
              <tr
                key={item.memberId}
                className={`mobile-collapsible-row hover:bg-[var(--surface-soft)] transition-colors ${expanded ? "is-expanded" : ""}`}
              >
                <td className="data-table-primary px-4 py-3 font-medium text-[var(--foreground)]" data-label="Membre">
                  {item.memberName}
                </td>
                <td className="px-4 py-3 mobile-detail-cell" data-label="Telephone">
                  {item.phone}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-[var(--danger)]" data-label="Montant">
                  {formatCurrency(item.totalDebt)}
                </td>
                <td className="px-4 py-3 text-right mobile-detail-cell" data-label="Dossiers">
                  {item.subscriptions}
                </td>
                <td className="mobile-toggle-cell px-4 py-3 text-center md:hidden">
                  <button
                    type="button"
                    className="mobile-card-toggle"
                    onClick={() => toggleExpand(item.memberId)}
                    aria-expanded={expanded}
                  >
                    {expanded ? "Voir moins" : "Voir plus"}
                    <ChevronDown className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
