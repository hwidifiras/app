"use client";

import Link from "next/link";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
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

export type SubscriptionRow = {
  id: string;
  memberName: string;
  memberPhone: string;
  planName: string;
  amount: number;
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

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR");
}

export function SubscriptionsListClient({ subscriptions }: { subscriptions: SubscriptionRow[] }) {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  function toggle(id: string) {
    setExpandedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  if (subscriptions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        Aucun abonnement enregistré.
      </div>
    );
  }

  return (
    <DataTable>
      <DataTableHead>
        <tr>
          <Th>Membre</Th>
          <Th>Plan</Th>
          <Th className="hidden sm:table-cell">Montant</Th>
          <Th className="hidden md:table-cell">Début</Th>
          <Th className="hidden md:table-cell">Fin</Th>
          <Th className="hidden lg:table-cell">Payé</Th>
          <Th>Statut</Th>
          <Th className="hidden sm:table-cell text-center">Séances</Th>
          <Th className="hidden text-right md:table-cell">Actions</Th>
          <Th className="px-2 text-center md:hidden"> </Th>
        </tr>
      </DataTableHead>
      <DataTableBody>
        {subscriptions.map((sub) => {
          const isExpanded = expandedIds.includes(sub.id);
          const paidOk = sub.totalPaid >= sub.amount;
          return (
            <DataTableRow key={sub.id} expanded={isExpanded}>
              <Td label="Membre" primary className="font-medium">
                {sub.memberName}
                <p className="text-xs text-muted-foreground">{sub.memberPhone}</p>
              </Td>
              <Td label="Plan" mobileDetail>
                {sub.planName}
              </Td>
              <Td label="Montant" className="hidden sm:table-cell">
                {formatCurrency(sub.amount)}
              </Td>
              <Td label="Début" mobileDetail className="hidden md:table-cell">
                {formatDate(sub.startDate)}
              </Td>
              <Td label="Fin" mobileDetail className="hidden md:table-cell">
                {formatDate(sub.endDate)}
              </Td>
              <Td label="Payé" mobileDetail className="hidden lg:table-cell">
                <span className={paidOk ? "font-semibold text-[var(--success)]" : "font-semibold text-amber-700"}>
                  {formatCurrency(sub.totalPaid)}
                </span>
              </Td>
              <Td label="Statut">
                <StatusBadge variant={statusVariant(sub.status)}>{statusLabel(sub.status)}</StatusBadge>
              </Td>
              <Td label="Séances" mobileDetail className="hidden text-center sm:table-cell">
                <span className={sub.remainingSessions > 0 ? "text-[var(--primary)]" : "text-[var(--danger)]"}>
                  {sub.remainingSessions} / {sub.totalSessions}
                </span>
              </Td>
              <Td label="Montant" mobileDetail className="md:hidden">
                {formatCurrency(sub.amount)}
              </Td>
              <Td label="Payé" mobileDetail className="md:hidden">
                <span className={paidOk ? "text-[var(--success)]" : "text-amber-700"}>{formatCurrency(sub.totalPaid)}</span>
              </Td>
              <Td label="Séances" mobileDetail className="md:hidden">
                {sub.remainingSessions} / {sub.totalSessions}
              </Td>
              <TableActionsCell className="mobile-detail-cell">
                <Link href={`/subscriptions/${sub.id}/edit`} className="btn btn-ghost btn-sm">
                  Modifier
                </Link>
              </TableActionsCell>
              <MobileRowToggle expanded={isExpanded} onToggle={() => toggle(sub.id)} />
            </DataTableRow>
          );
        })}
      </DataTableBody>
    </DataTable>
  );
}
