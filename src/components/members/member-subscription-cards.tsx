import Link from "next/link";

import { StatusBadge } from "@/components/ui/status-badge";
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
    return <p className="text-sm text-[var(--muted-foreground)]">Aucun abonnement enregistré.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {subscriptions.map((sub) => {
        const progress = paymentProgressPercent(sub.paidCents, sub.amount);
        const isPaid = sub.paidCents >= sub.amount;
        const isActive = sub.status === "ACTIVE";

        return (
          <article
            key={sub.id}
            className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"
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

            {!isPaid ? (
              <Link
                href={`/payments/new?memberSubscriptionId=${sub.id}`}
                className="btn btn-ghost btn-sm mt-3 inline-flex w-full justify-center text-xs"
              >
                Encaisser le solde
              </Link>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
