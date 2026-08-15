import Link from "next/link";
import { BookOpen, Dumbbell, Layers3, RefreshCw } from "lucide-react";

import {
  DashboardPanel,
  DashboardSectionHeader,
} from "@/components/dashboard/dashboard-ui";
import { formatMoney } from "@/lib/money";
import type { HybridPortfolioReport } from "@/modules/reports/hybrid-portfolio";

function formatDate(date: Date | null) {
  return date ? date.toLocaleDateString("fr-FR", { timeZone: "UTC" }) : null;
}

export function DashboardHybridPanel({ report }: { report: HybridPortfolioReport }) {
  const cohorts = [
    { label: "Cours seuls", value: report.classOnlyMembers, icon: BookOpen, tone: "text-blue-700 bg-blue-50" },
    { label: "Salle seule", value: report.gymOnlyMembers, icon: Dumbbell, tone: "text-emerald-700 bg-emerald-50" },
    { label: "Cours + salle", value: report.combinedMembers, icon: Layers3, tone: "text-violet-700 bg-violet-50" },
  ];

  return (
    <DashboardPanel labelledBy="dashboard-hybrid-title" className="min-w-0">
      <DashboardSectionHeader
        titleId="dashboard-hybrid-title"
        title="Portefeuille hybride"
        eyebrow="Membres et renouvellements"
        action={
          <Link href="/subscriptions" className="text-xs font-semibold text-[var(--primary)] hover:underline">
            Voir les abonnements
          </Link>
        }
      />

      <div className="grid gap-3 p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {cohorts.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3">
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                <Icon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-lg font-bold text-[var(--foreground)]">{value}</p>
                <p className="truncate text-xs text-[var(--muted-foreground)]">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 border-t border-[var(--border)] pt-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Packs mixtes ce mois</p>
              <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{report.mixedSalesMonth}</p>
              <p className="text-xs text-[var(--muted-foreground)]">{formatMoney(report.mixedSalesAmountCents)}</p>
            </div>
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Renouvellements</p>
              <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{report.mixedRenewalsMonth}</p>
              <p className="text-xs text-[var(--muted-foreground)]">packs renouvelés</p>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--foreground)]">
                <RefreshCw className="size-3.5 text-[var(--warning)]" />
                À renouveler ({report.renewalOpportunities})
              </p>
              <Link href="/subscriptions" className="text-xs font-semibold text-[var(--primary)] hover:underline">
                Traiter
              </Link>
            </div>
            {report.renewalItems.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">Aucune échéance urgente.</p>
            ) : (
              <ul className="mt-2 divide-y divide-[var(--border)]">
                {report.renewalItems.slice(0, 3).map((item) => (
                  <li key={item.memberId} className="flex min-w-0 items-center justify-between gap-3 py-2 first:pt-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">{item.memberName}</p>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">
                        {item.planName}
                        {item.endDate ? ` · fin ${formatDate(item.endDate)}` : ""}
                        {item.remainingUnits != null ? ` · ${item.remainingUnits} restant(s)` : ""}
                      </p>
                    </div>
                    <Link href={`/members/${item.memberId}`} prefetch={false} className="btn btn-ghost btn-sm shrink-0">
                      Voir
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </DashboardPanel>
  );
}
