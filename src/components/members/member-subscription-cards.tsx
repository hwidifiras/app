import Link from "next/link";
import { CreditCard } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { paymentProgressPercent } from "@/lib/member-avatar";
import { formatMoney } from "@/lib/subscription-billing";

type SubscriptionCard = {
  id: string;
  planName: string;
  sportName: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  amount: number;
  paidCents: number;
  remainingSessions: number;
  totalSessions: number;
};

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("fr-FR");
}

export function MemberSubscriptionCards({ subscriptions }: { subscriptions: SubscriptionCard[] }) {
  if (subscriptions.length === 0) {
    return (
      <EmptyState
        icon={<CreditCard className="size-8 opacity-45" />}
        title="Aucun abonnement"
        message="Ajoutez une formule pour suivre les séances, les dates et les paiements."
        action={<Link href="/subscriptions/new" className="btn btn-primary">Renouveler</Link>}
        className="py-8"
      />
    );
  }

  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))]">
      {subscriptions.map((sub) => {
        const progress = paymentProgressPercent(sub.paidCents, sub.amount);
        const isPaid = sub.paidCents >= sub.amount;
        const isActive = sub.status === "ACTIVE";

        return (
          <article
            key={sub.id}
            className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--foreground)]">{sub.planName}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{sub.sportName}</p>
              </div>
              <StatusBadge
                variant={
                  isActive ? "success" : sub.status === "EXPIRED" ? "warning" : sub.status === "DRAFT" ? "info" : "danger"
                }
              >
                {isActive
                  ? "Actif"
                  : sub.status === "DRAFT"
                    ? "Brouillon"
                    : sub.status === "EXPIRED"
                      ? "Expiré"
                      : "Annulé"}
              </StatusBadge>
            </div>

            <p className="mt-2 text-xs text-[var(--muted-foreground)]">
              {formatDate(sub.startDate)}
              {sub.endDate ? ` → ${formatDate(sub.endDate)}` : ""}
            </p>

            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className={isPaid ? "text-[var(--success)]" : "text-[var(--warning)]"}>
                  {formatMoney(sub.paidCents)} / {formatMoney(sub.amount)}
                </span>
                <span className="text-[var(--muted-foreground)]">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]">
                <div
                  className={`h-full rounded-full transition-all ${
                    isPaid ? "bg-[var(--success)]" : "bg-[var(--warning)]"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {isActive ? (
              <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                <span className={sub.remainingSessions > 0 ? "text-[var(--info)]" : "text-[var(--danger)]"}>
                  {sub.remainingSessions}
                </span>
                {" / "}
                {sub.totalSessions} séances restantes
              </p>
            ) : null}

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {!isPaid ? (
                <Link
                  href={`/payments/new?memberSubscriptionId=${sub.id}`}
                  className="btn btn-primary btn-sm inline-flex w-full justify-center text-xs"
                >
                  Encaisser
                </Link>
              ) : null}
              <Link
                href={`/subscriptions/${sub.id}/edit`}
                className={`btn btn-ghost btn-sm inline-flex w-full justify-center text-xs ${
                  isPaid ? "sm:col-span-2" : ""
                }`}
              >
                Voir
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
