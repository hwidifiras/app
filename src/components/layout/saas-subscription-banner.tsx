"use client";

import { AlertTriangle } from "lucide-react";

import { useAppShellData } from "@/components/layout/app-shell-data-provider";

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("fr-TN", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

export function SaasSubscriptionBanner() {
  const { account } = useAppShellData();
  if (account?.role !== "ADMIN" || !account.billingWarning) return null;

  const graceEnd = formatDate(account.saasSubscription?.graceEndsAt);
  const periodEnd = formatDate(account.saasSubscription?.currentPeriodEnd);
  const message = account.billingWarning === "GRACE"
    ? `Votre abonnement est en période de grâce${graceEnd ? ` jusqu'au ${graceEnd}` : ""}. Régularisez-le pour éviter une interruption.`
    : `Le règlement de votre abonnement est en attente${periodEnd ? ` depuis le ${periodEnd}` : ""}. Le club reste accessible pour le moment.`;

  return (
    <div className="print:hidden" role="status">
      <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 lg:px-5 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          <strong>Abonnement We Discipline.</strong> {message}
        </p>
      </div>
    </div>
  );
}
