"use client";

import Link from "next/link";
import { AlertTriangle, Clock3 } from "lucide-react";

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

  const deadline = formatDate(account.subscriptionDeadlineAt);
  const days = account.subscriptionDaysRemaining;
  const isTrialNotice = account.billingWarning === "TRIAL_ENDING";
  const message = account.billingWarning === "TRIAL_ENDING"
    ? `Votre essai se termine${days !== null ? ` dans ${days} jour${days > 1 ? "s" : ""}` : " bientôt"}${deadline ? `, le ${deadline}` : ""}.`
    : account.billingWarning === "TRIAL_GRACE"
      ? `Votre essai est terminé. L'accès reste ouvert${deadline ? ` jusqu'au ${deadline}` : " temporairement"}.`
      : account.billingWarning === "GRACE"
        ? `Votre abonnement est en période de grâce${deadline ? ` jusqu'au ${deadline}` : ""}. Régularisez-le pour éviter une interruption.`
        : `Le règlement de votre abonnement est en attente${deadline ? ` depuis le ${deadline}` : ""}. Le club reste accessible pour le moment.`;
  const Icon = isTrialNotice ? Clock3 : AlertTriangle;

  return (
    <div className="print:hidden" role="status">
      <div
        className={isTrialNotice
          ? "flex items-start gap-2 border-b border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-950 lg:px-5 dark:border-blue-900/70 dark:bg-blue-950/35 dark:text-blue-100"
          : "flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 lg:px-5 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-100"}
      >
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1">
          <strong>Abonnement We Discipline.</strong> {message}
        </p>
        <Link href="/subscription-status" className="shrink-0 font-semibold underline underline-offset-2">
          Voir
        </Link>
      </div>
    </div>
  );
}
