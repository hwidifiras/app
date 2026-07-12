import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import {
  AlertCircle,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  Dumbbell,
  Repeat2,
  UserPlus,
  UsersRound,
  Wallet,
} from "lucide-react";

import { CashRegisterPanel, CashTrendPanel } from "@/components/dashboard/dashboard-cash-panels";
import { DashboardDebtsSection } from "@/components/dashboard/dashboard-debts-section";
import {
  buildCashTrend,
  formatPaymentMethodLabel,
  memberInitials,
  paymentMethodTone,
  sumPaymentAmounts,
  type CashMethodStat,
  type CashTrendDay,
  type DashboardPayment,
  type PaymentEntryTypeValue,
  type RecentMemberPreview,
} from "@/components/dashboard/dashboard-model";
import { getClubSettings } from "@/lib/club-settings";
import {
  canUseDashboardViewOverride,
  getDashboardWidgetVisibility,
  resolveDashboardMode,
  type DashboardPreferenceSettings,
} from "@/lib/dashboard-preferences";
import {
  computeFinanceSnapshot,
  computeMemberDebts,
  startOfUtcMonth,
  startOfUtcWeek,
} from "@/lib/dashboard-finance";
import { utcDateOnlyForTimeZone } from "@/lib/dates";
import { isPaymentReminderEmailConfigured } from "@/lib/email";
import { enrichDebtsWithReminderMeta } from "@/lib/payment-reminders";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/request-user";
import { isTenantModuleEnabled } from "@/lib/tenant-modules";
import {
  deriveSessionLifecycle,
  expectedMemberIdsAtSession,
} from "@/lib/session-lifecycle";
import { formatMoney } from "@/lib/subscription-billing";
import {
  DashboardPanel,
  DashboardSectionHeader,
  dashboardToneStyles,
} from "@/components/dashboard/dashboard-ui";
import {
  TodayWorkPanel,
  type PriorityItem,
  type TodaySession,
} from "@/components/dashboard/dashboard-today-panel";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DebtAgingBucket = {
  label: string;
  amount: number;
  subscriptions: number;
  tone: "green" | "amber" | "red";
};

type SalesBreakdownItem = {
  label: string;
  sublabel: string;
  amount: number;
  subscriptions: number;
};

type DiscountSnapshot = {
  catalogueMonth: number;
  discountMonth: number;
  discountedSubscriptions: number;
  discountRatePercent: number | null;
};

type ReceiptSnapshot = {
  paymentCountMonth: number;
  issuedMonth: number;
  missingMonth: number;
  voidedMonth: number;
};

type DataConfidenceItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
};

function DataConfidencePanel({ items }: { items: DataConfidenceItem[] }) {
  if (items.length === 0) return null;

  return (
    <DashboardPanel labelledBy="dashboard-data-confidence-title" className="border-[#FDE68A] bg-[#FFFBEB]">
      <DashboardSectionHeader
        titleId="dashboard-data-confidence-title"
        title="Données à vérifier"
        eyebrow="Confiance"
        action={
          <Link href="/settings" className="text-xs font-semibold text-[#B45309] hover:underline">
            Réglages
          </Link>
        }
      />
      <div className="grid gap-2 p-3 md:grid-cols-2">
        {items.slice(0, 4).map((item) => (
          <div key={item.id} className="rounded-lg border border-[#FDE68A] bg-white px-3 py-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#FFFBEB] text-[#B45309]">
                <AlertCircle className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#0B1220]">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-[#64748B]">{item.detail}</p>
                <Link
                  href={item.href}
                  prefetch={false}
                  className="mt-2 inline-flex min-h-8 items-center rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 text-xs font-semibold text-[#92400E] transition hover:bg-[#FEF3C7]"
                >
                  {item.actionLabel}
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}

function MembersOverviewPanel({
  activeMembers,
  newMembersThisMonth,
  expiringSoon,
  pendingPayment,
  recentMembers,
}: {
  activeMembers: number;
  newMembersThisMonth: number;
  expiringSoon: number;
  pendingPayment: number;
  recentMembers: RecentMemberPreview[];
}) {
  const stats = [
    {
      label: "Membres actifs",
      value: activeMembers,
      icon: UsersRound,
      tone: "blue" as const,
    },
    {
      label: "Nouveaux ce mois",
      value: newMembersThisMonth,
      icon: UserPlus,
      tone: "green" as const,
    },
    {
      label: "Abonnements expirant bientôt",
      value: expiringSoon,
      icon: CalendarClock,
      tone: "amber" as const,
    },
    {
      label: "En attente de paiement",
      value: pendingPayment,
      icon: CreditCard,
      tone: "red" as const,
    },
  ];

  return (
    <DashboardPanel labelledBy="dashboard-members-overview-title" className="min-w-0">
      <DashboardSectionHeader
        titleId="dashboard-members-overview-title"
        title="Aperçu rapide"
        eyebrow="Membres"
        action={
          <Link href="/members" className="text-xs font-semibold text-[#2563EB] hover:underline">
            Voir tout
          </Link>
        }
      />
      <div className="p-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const tone = dashboardToneStyles[stat.tone];
            const Icon = stat.icon;
            return (
              <Link
                key={stat.label}
                href={stat.label === "En attente de paiement" ? "/subscriptions" : "/members"}
                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.045)] transition hover:-translate-y-0.5 hover:border-[#2563EB] hover:shadow-[0_12px_26px_rgba(37,99,235,0.10)]"
              >
                <span className={cn("flex size-7 items-center justify-center rounded-lg", tone.soft, tone.text)}>
                  <Icon className="size-4" />
                </span>
                <span className="mt-2 block text-lg font-bold leading-none text-[#0B1220]">{stat.value}</span>
                <span className="mt-1 block text-[0.72rem] leading-snug text-[#475569]">{stat.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
            Derniers membres
          </p>
          {recentMembers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#D8E2F0] bg-[#F8FAFC] px-4 py-6 text-center">
              <UsersRound className="mx-auto size-8 text-[#94A3B8]" />
              <p className="mt-2 text-sm font-semibold text-[#0B1220]">Aucun membre récent</p>
              <p className="mt-1 text-xs text-[#64748B]">Les nouvelles inscriptions apparaîtront ici.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {recentMembers.map((member) => (
                <li key={member.id}>
                  <Link
                    href={`/members/${member.id}`}
                    prefetch={false}
                    className="flex items-center gap-3 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 transition hover:border-[#2563EB] hover:bg-[#F8FAFC]"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-xs font-bold text-[#2563EB]">
                      {member.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#0B1220]">{member.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-[#64748B]">{member.planName}</span>
                    </span>
                    <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[0.68rem] font-semibold text-[#047857]">
                      {member.status}
                    </span>
                    <span className="hidden shrink-0 text-xs font-medium text-[#64748B] sm:inline">
                      {member.joinedAt.toLocaleDateString("fr-FR")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardPanel>
  );
}

function DashboardMetric({ icon: Icon, label, value, tone }: { icon: ComponentType<{ className?: string }>; label: string; value: string; tone: "blue" | "green" | "amber" }) {
  const toneClass = tone === "green" ? "text-emerald-600 bg-emerald-50" : tone === "amber" ? "text-amber-600 bg-amber-50" : "text-blue-600 bg-blue-50";
  return <div className="rounded-lg border border-[#D8E2F0] bg-white p-3"><Icon className={`size-5 rounded-md p-0.5 ${toneClass}`} /><p className="mt-3 text-xl font-bold text-[#0B1220]">{value}</p><p className="text-xs text-slate-500">{label}</p></div>;
}

function GymOverviewPanel({ visitsToday, activePasses, expiringSoon }: { visitsToday: number; activePasses: number; expiringSoon: number }) {
  return (
    <DashboardPanel labelledBy="dashboard-gym-title">
      <DashboardSectionHeader titleId="dashboard-gym-title" title="Accès salle" eyebrow="Module gym" action={<Link href="/gym/check-in" className="text-xs font-semibold text-[#2563EB] hover:underline">Pointer une entrée</Link>} />
      <div className="grid gap-2 p-3 sm:grid-cols-3">
        <DashboardMetric icon={Dumbbell} label="Entrées aujourd'hui" value={String(visitsToday)} tone="blue" />
        <DashboardMetric icon={CreditCard} label="Pass actifs" value={String(activePasses)} tone="green" />
        <DashboardMetric icon={CalendarClock} label="Expirent bientôt" value={String(expiringSoon)} tone={expiringSoon > 0 ? "amber" : "green"} />
      </div>
    </DashboardPanel>
  );
}

function CommercialQuietStatePanel() {
  return (
    <DashboardPanel labelledBy="dashboard-commercial-quiet-title" className="min-w-0">
      <DashboardSectionHeader
        titleId="dashboard-commercial-quiet-title"
        title="Activité commerciale"
        eyebrow="Pilotage"
        action={
          <Link href="/subscriptions" className="text-xs font-semibold text-[#2563EB] hover:underline">
            Abonnements
          </Link>
        }
      />
      <div className="grid gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="rounded-lg border border-dashed border-[#D8E2F0] bg-[#F8FAFC] px-4 py-4">
          <p className="text-sm font-semibold text-[#0B1220]">Aucune activité commerciale ce mois.</p>
          <p className="mt-1 text-xs leading-5 text-[#64748B]">
            Les ventes, remises et reçus apparaîtront ici dès qu&apos;une inscription, un renouvellement ou un
            encaissement sera créé.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          <Link
            href="/enrollment"
            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[#2563EB] px-3 text-sm font-semibold !text-white transition hover:bg-[#1D4ED8]"
          >
            Inscrire
          </Link>
          <Link
            href="/payments/new"
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#D8E2F0] bg-white px-3 text-sm font-semibold text-[#0B1220] transition hover:border-[#2563EB] hover:text-[#2563EB]"
          >
            Encaisser
          </Link>
        </div>
      </div>
    </DashboardPanel>
  );
}

function SalesSnapshotPanel({
  salesToday,
  salesTodayCount,
  salesMonth,
  revenueToday,
  remainingOnTodaySales,
  newSalesToday,
  renewalSalesToday,
  newSalesMonth,
  renewalSalesMonth,
  debtAgingBuckets,
  topSalesItems,
  discountSnapshot,
  receiptSnapshot,
}: {
  salesToday: number;
  salesTodayCount: number;
  salesMonth: number;
  revenueToday: number;
  remainingOnTodaySales: number;
  newSalesToday: number;
  renewalSalesToday: number;
  newSalesMonth: number;
  renewalSalesMonth: number;
  debtAgingBuckets: DebtAgingBucket[];
  topSalesItems: SalesBreakdownItem[];
  discountSnapshot: DiscountSnapshot;
  receiptSnapshot: ReceiptSnapshot;
}) {
  const moneyStats = [
    {
      label: "Ventes aujourd'hui",
      value: formatMoney(salesToday),
      detail: `${salesTodayCount} abonnement${salesTodayCount > 1 ? "s" : ""} créé${salesTodayCount > 1 ? "s" : ""}`,
      tone: "blue" as const,
    },
    {
      label: "Encaissé aujourd'hui",
      value: formatMoney(revenueToday),
      detail: "Paiements réellement reçus",
      tone: "green" as const,
    },
    {
      label: "Reste ventes du jour",
      value: formatMoney(remainingOnTodaySales),
      detail: "À encaisser sur les ventes du jour",
      tone: remainingOnTodaySales > 0 ? ("amber" as const) : ("green" as const),
    },
  ];

  const flowStats = [
    {
      label: "Nouvelles inscriptions",
      icon: UserPlus,
      today: newSalesToday,
      month: newSalesMonth,
      tone: "blue" as const,
    },
    {
      label: "Renouvellements",
      icon: Repeat2,
      today: renewalSalesToday,
      month: renewalSalesMonth,
      tone: "slate" as const,
    },
  ];

  return (
    <DashboardPanel labelledBy="dashboard-sales-title" className="min-w-0">
      <DashboardSectionHeader
        titleId="dashboard-sales-title"
        title="Ventes vs encaissé"
        eyebrow="Suivi commercial"
        action={
          <Link href="/subscriptions" className="text-xs font-semibold text-[#2563EB] hover:underline">
            Abonnements
          </Link>
        }
      />
      <div className="space-y-3 p-3">
        <div className="grid gap-2 md:grid-cols-3">
          {moneyStats.map((stat) => {
            const tone = dashboardToneStyles[stat.tone];
            return (
              <div key={stat.label} className={cn("rounded-lg border px-3 py-3", tone.soft, tone.border)}>
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
                  {stat.label}
                </p>
                <p className="mt-2 text-lg font-bold leading-tight text-[#0B1220]">{stat.value}</p>
                <p className="mt-1 text-xs leading-snug text-[#475569]">{stat.detail}</p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {flowStats.map((stat) => {
            const tone = dashboardToneStyles[stat.tone];
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-3">
                <div className="flex items-center gap-2">
                  <span className={cn("flex size-8 items-center justify-center rounded-lg", tone.soft, tone.text)}>
                    <Icon className="size-4" />
                  </span>
                  <p className="text-sm font-semibold text-[#0B1220]">{stat.label}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-[#F8FAFC] px-3 py-2">
                    <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                      Aujourd&apos;hui
                    </p>
                    <p className="mt-1 text-lg font-bold text-[#0B1220]">{stat.today}</p>
                  </div>
                  <div className="rounded-lg bg-[#F8FAFC] px-3 py-2">
                    <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                      Ce mois
                    </p>
                    <p className="mt-1 text-lg font-bold text-[#0B1220]">{stat.month}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-2 lg:grid-cols-2">
          <div className="rounded-lg border border-[#E2E8F0] bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
                  Impayés
                </p>
                <h3 className="text-sm font-semibold text-[#0B1220]">Par ancienneté</h3>
              </div>
              <Link href="/subscriptions" className="text-xs font-semibold text-[#2563EB] hover:underline">
                Relancer
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {debtAgingBuckets.map((bucket) => {
                const tone = dashboardToneStyles[bucket.tone];
                return (
                  <div key={bucket.label} className={cn("rounded-lg border px-3 py-2", tone.soft, tone.border)}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#0B1220]">{bucket.label}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[0.66rem] font-semibold", tone.badge)}>
                        {bucket.subscriptions}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-[#0B1220]">{formatMoney(bucket.amount)}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-[#E2E8F0] bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
                  Ventes
                </p>
                <h3 className="text-sm font-semibold text-[#0B1220]">Top ce mois</h3>
              </div>
              <Link href="/subscription-plans" className="text-xs font-semibold text-[#2563EB] hover:underline">
                Formules
              </Link>
            </div>
            {topSalesItems.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-[#D8E2F0] bg-[#F8FAFC] px-3 py-5 text-center text-xs text-[#64748B]">
                Aucune vente ce mois.
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {topSalesItems.map((item) => (
                  <li key={`${item.label}-${item.sublabel}`} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[#0B1220]">{item.label}</p>
                        <p className="mt-0.5 truncate text-[0.68rem] text-[#64748B]">{item.sublabel}</p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-[#0B1220]">{formatMoney(item.amount)}</p>
                    </div>
                    <p className="mt-1 text-[0.68rem] text-[#64748B]">
                      {item.subscriptions} abonnement{item.subscriptions > 1 ? "s" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-2">
          <div className="rounded-lg border border-[#E2E8F0] bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
                  Offres
                </p>
                <h3 className="text-sm font-semibold text-[#0B1220]">Remises ce mois</h3>
              </div>
              <Link href="/offers" className="text-xs font-semibold text-[#2563EB] hover:underline">
                Offres
              </Link>
            </div>
            <div className="mt-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-3">
              <p className="text-lg font-bold leading-tight text-[#0B1220]">
                {formatMoney(discountSnapshot.discountMonth)}
              </p>
              <p className="mt-1 text-xs text-[#475569]">
                {discountSnapshot.discountedSubscriptions} abonnement
                {discountSnapshot.discountedSubscriptions > 1 ? "s" : ""} avec remise
              </p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-[#F8FAFC] px-3 py-2">
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                  Catalogue
                </p>
                <p className="mt-1 text-sm font-bold text-[#0B1220]">{formatMoney(discountSnapshot.catalogueMonth)}</p>
              </div>
              <div className="rounded-lg bg-[#F8FAFC] px-3 py-2">
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                  Taux
                </p>
                <p className="mt-1 text-sm font-bold text-[#0B1220]">
                  {discountSnapshot.discountRatePercent === null ? "—" : `${discountSnapshot.discountRatePercent}%`}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[#E2E8F0] bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
                  Reçus
                </p>
                <h3 className="text-sm font-semibold text-[#0B1220]">Traçabilité ce mois</h3>
              </div>
              <Link href="/payments" className="text-xs font-semibold text-[#2563EB] hover:underline">
                Caisse
              </Link>
            </div>
            <div
              className={cn(
                "mt-3 rounded-lg border px-3 py-3",
                receiptSnapshot.missingMonth > 0
                  ? "border-[#FECACA] bg-[#FEF2F2]"
                  : "border-[#A7F3D0] bg-[#ECFDF5]",
              )}
            >
              <p className="text-lg font-bold leading-tight text-[#0B1220]">
                {receiptSnapshot.issuedMonth}/{receiptSnapshot.paymentCountMonth}
              </p>
              <p className="mt-1 text-xs text-[#475569]">paiements avec reçu émis</p>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-[#F8FAFC] px-3 py-2">
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                  À vérifier
                </p>
                <p className="mt-1 text-sm font-bold text-[#0B1220]">{receiptSnapshot.missingMonth}</p>
              </div>
              <div className="rounded-lg bg-[#F8FAFC] px-3 py-2">
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                  Annulés
                </p>
                <p className="mt-1 text-sm font-bold text-[#0B1220]">{receiptSnapshot.voidedMonth}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-dashed border-[#D8E2F0] bg-[#F8FAFC] px-3 py-2 text-xs leading-5 text-[#475569]">
          Ventes = abonnements créés. Encaissé = paiements réellement reçus. Total ventes ce mois :
          <span className="font-semibold text-[#0B1220]"> {formatMoney(salesMonth)}</span>.
        </div>
      </div>
    </DashboardPanel>
  );
}

function formatDateFr(value: Date) {
  return value.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
  });
}

function formatLongDateFr(value: Date) {
  return value.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function DashboardGridRow({
  children,
  variant = "balanced",
}: {
  children: ReactNode[];
  variant?: "balanced" | "wideLeft" | "wideRight";
}) {
  const visibleChildren = children.filter(Boolean);
  if (visibleChildren.length === 0) return null;

  const columns =
    visibleChildren.length === 1
      ? ""
      : variant === "wideLeft"
        ? "xl:grid-cols-[minmax(0,1.25fr)_minmax(24rem,0.85fr)]"
        : variant === "wideRight"
          ? "xl:grid-cols-[minmax(24rem,0.85fr)_minmax(0,1.25fr)]"
          : "xl:grid-cols-2";

  return (
    <section className={cn("grid items-start gap-4", columns)}>
      {visibleChildren.map((child, index) => (
        <div key={index} className="min-w-0">
          {child}
        </div>
      ))}
    </section>
  );
}

function DashboardViewSwitcher({ mode, canSwitch }: { mode: "RECEPTION" | "PILOTAGE"; canSwitch: boolean }) {
  if (!canSwitch) return null;

  const options = [
    { mode: "RECEPTION" as const, label: "Reception", href: "/?view=reception" },
    { mode: "PILOTAGE" as const, label: "Pilotage", href: "/?view=pilotage" },
  ];

  return (
    <nav
      aria-label="Vue dashboard"
      className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border border-[#DDE7F4] bg-white/90 px-3 py-2 shadow-[0_12px_30px_rgba(15,23,42,0.045)]"
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold text-[#0B1220]">Lecture du dashboard</p>
        <p className="text-xs text-[#64748B]">Reception pour le quotidien, pilotage pour les indicateurs.</p>
      </div>
      <div className="inline-flex rounded-lg border border-[#DDE7F4] bg-[#F8FAFC] p-1">
        {options.map((option) => {
          const selected = mode === option.mode;
          return (
            <Link
              key={option.mode}
              href={option.href}
              prefetch={false}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "min-h-9 rounded-md px-3 py-2 text-xs font-semibold transition",
                selected ? "bg-[#2563EB] text-white shadow-sm" : "text-[#475569] hover:bg-white hover:text-[#0B1220]",
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function EmptyDashboardConfigurationPanel({ isAdmin }: { isAdmin: boolean }) {
  return (
    <DashboardPanel labelledBy="dashboard-empty-config-title" className="min-w-0">
      <div className="p-5 text-center">
        <p id="dashboard-empty-config-title" className="text-base font-semibold text-[#0B1220]">
          Dashboard configure sans blocs
        </p>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#64748B]">
          {isAdmin
            ? "Activez au moins un bloc dans les reglages du club pour retrouver une vue exploitable."
            : "Dashboard configure par l'administrateur."}
        </p>
        {isAdmin ? (
          <Link href="/settings/club#club-dashboard" className="btn btn-primary mt-4 inline-flex" prefetch={false}>
            Ouvrir les reglages
          </Link>
        ) : null}
      </div>
    </DashboardPanel>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>;
}) {
  const dashboardParams = searchParams ? await searchParams : {};
  const authUser = await getAuthUser();

  if (!authUser) {
    return (
      <main className="app-shell py-4 md:py-8">
        <section className="panel panel-soft p-5">
          <p className="text-sm font-semibold text-[var(--foreground)]">Dashboard indisponible</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Connectez-vous pour afficher les données du club.</p>
        </section>
      </main>
    );
  }

  const tenantId = authUser.tenantId;
  let hasDataError = false;
  let activeMembers = 0;
  let newMembersThisMonth = 0;
  let sessionsToday = 0;
  let revenueToday = 0;
  let revenueWeek = 0;
  let revenueMonth = 0;
  let paymentCountToday = 0;
  let averagePaymentToday = 0;
  let correctionsToday = 0;
  let reversalsToday = 0;
  let salesToday = 0;
  let salesTodayCount = 0;
  let salesMonth = 0;
  let remainingOnTodaySales = 0;
  let newSalesToday = 0;
  let renewalSalesToday = 0;
  let newSalesMonth = 0;
  let renewalSalesMonth = 0;
  let debtAgingBuckets: DebtAgingBucket[] = [
    { label: "0-7 jours", amount: 0, subscriptions: 0, tone: "green" },
    { label: "8-30 jours", amount: 0, subscriptions: 0, tone: "amber" },
    { label: "30+ jours", amount: 0, subscriptions: 0, tone: "red" },
  ];
  let topSalesItems: SalesBreakdownItem[] = [];
  let discountSnapshot: DiscountSnapshot = {
    catalogueMonth: 0,
    discountMonth: 0,
    discountedSubscriptions: 0,
    discountRatePercent: null,
  };
  let receiptSnapshot: ReceiptSnapshot = {
    paymentCountMonth: 0,
    issuedMonth: 0,
    missingMonth: 0,
    voidedMonth: 0,
  };
  let cashMethodStats: CashMethodStat[] = [];
  let cashTrend: CashTrendDay[] = [];
  let recentMembers: RecentMemberPreview[] = [];
  let finance = {
    totalOutstandingCents: 0,
    debtorsCount: 0,
    partialPayersCount: 0,
    collectionRatePercent: null as number | null,
    expiringIn7Days: 0,
    activeSubscriptionsCount: 0,
  };
  let debts: Awaited<ReturnType<typeof enrichDebtsWithReminderMeta>> = [];
  let todaySessions: TodaySession[] = [];
  let finalizationSessions: TodaySession[] = [];
  let priorityItems: PriorityItem[] = [];
  let dataConfidenceItems: DataConfidenceItem[] = [];
  let emailConfigured = false;
  let gymModuleEnabled = false;
  let showGymOverview = true;
  let gymStats = { visitsToday: 0, activePasses: 0, expiringSoon: 0 };
  let dashboardPreferences: DashboardPreferenceSettings = {
    dashboardDefaultMode: "AUTO",
    dashboardShowTodaySessions: true,
    dashboardShowCashToday: true,
    dashboardShowDataConfidence: true,
    dashboardShowCashTrend: true,
    dashboardShowMembersOverview: true,
    dashboardShowCommercialInsights: true,
    dashboardShowDetailedDebts: true,
  };

  const now = new Date();
  const today = utcDateOnlyForTimeZone(now);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const weekStart = startOfUtcWeek(today);
  const monthStart = startOfUtcMonth(today);
  const trendStart = new Date(today);
  trendStart.setUTCDate(trendStart.getUTCDate() - 6);
  const paymentWindowStart = monthStart.getTime() < trendStart.getTime() ? monthStart : trendStart;
  const overdueSince = new Date(today);
  overdueSince.setUTCDate(overdueSince.getUTCDate() - 30);
  const sevenDaysFromToday = new Date(today);
  sevenDaysFromToday.setUTCDate(sevenDaysFromToday.getUTCDate() + 7);

  try {
    const clubSettings = await getClubSettings({ tenantId });
    gymModuleEnabled = await isTenantModuleEnabled(tenantId, "GYM");
    showGymOverview = clubSettings.dashboardShowGymOverview;
    dashboardPreferences = {
      dashboardDefaultMode: clubSettings.dashboardDefaultMode,
      dashboardShowTodaySessions: clubSettings.dashboardShowTodaySessions,
      dashboardShowCashToday: clubSettings.dashboardShowCashToday,
      dashboardShowDataConfidence: clubSettings.dashboardShowDataConfidence,
      dashboardShowCashTrend: clubSettings.dashboardShowCashTrend,
      dashboardShowMembersOverview: clubSettings.dashboardShowMembersOverview,
      dashboardShowCommercialInsights: clubSettings.dashboardShowCommercialInsights,
      dashboardShowDetailedDebts: clubSettings.dashboardShowDetailedDebts,
    };
    if (gymModuleEnabled) {
      const [visitsToday, activePasses, expiringSoon] = await Promise.all([
        prisma.gymVisit.count({ where: { tenantId, entryType: "CHECK_IN", checkedAt: { gte: today, lt: tomorrow }, corrections: { none: { entryType: "REVERSAL" } } } }),
        prisma.subscriptionEntitlement.count({ where: { tenantId, type: "GYM_ACCESS", startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gte: now } }], memberSubscription: { status: "ACTIVE", member: { status: "ACTIVE" } } } }),
        prisma.subscriptionEntitlement.count({ where: { tenantId, type: "GYM_ACCESS", endDate: { gte: now, lte: sevenDaysFromToday }, memberSubscription: { status: "ACTIVE", member: { status: "ACTIVE" } } } }),
      ]);
      gymStats = { visitsToday, activePasses, expiringSoon };
    }

    const [
      fetchedActiveMembers,
      fetchedNewMembersThisMonth,
      fetchedSessionsToday,
      fetchedPaymentWindow,
      fetchedSubscriptions,
      fetchedSalesSubscriptions,
      fetchedReceiptWindow,
      fetchedSessions,
      fetchedRecentMembers,
    ] = await Promise.all([
      prisma.member.count({ where: { tenantId, status: "ACTIVE" } }),
      prisma.member.count({ where: { tenantId, status: "ACTIVE", joinedAt: { gte: monthStart, lt: tomorrow } } }),
      prisma.session.count({
        where: {
          tenantId,
          sessionDate: { gte: today, lt: tomorrow },
          status: { not: "CANCELLED" },
        },
      }),
      prisma.payment.findMany({
        where: { tenantId, paymentDate: { gte: paymentWindowStart, lt: tomorrow } },
        select: {
          id: true,
          amount: true,
          entryType: true,
          paymentMethod: true,
          paymentDate: true,
        },
        orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
      }),
      prisma.memberSubscription.findMany({
        where: { tenantId, status: "ACTIVE" },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          memberId: true,
          status: true,
          startDate: true,
          endDate: true,
          member: { select: { firstName: true, lastName: true, phone: true } },
          plan: { select: { name: true } },
          payments: { where: { tenantId }, select: { amount: true } },
        },
      }),
      prisma.memberSubscription.findMany({
        where: {
          tenantId,
          status: { in: ["ACTIVE", "EXPIRED"] },
          createdAt: { gte: monthStart, lt: tomorrow },
        },
        select: {
          id: true,
          amount: true,
          listPriceCents: true,
          discountCents: true,
          createdAt: true,
          memberId: true,
          member: { select: { joinedAt: true } },
          plan: { select: { name: true } },
          sport: { select: { name: true } },
          payments: { where: { tenantId }, select: { amount: true } },
        },
      }),
      prisma.receipt.findMany({
        where: {
          tenantId,
          issuedAt: { gte: monthStart, lt: tomorrow },
        },
        select: {
          id: true,
          status: true,
          payment: { select: { amount: true, entryType: true } },
        },
      }),
      prisma.session.findMany({
        where: {
          tenantId,
          sessionDate: { gte: overdueSince, lt: tomorrow },
          status: { in: ["PLANNED", "RESCHEDULED", "COMPLETED"] },
        },
        select: {
          id: true,
          sessionDate: true,
          startTime: true,
          endTime: true,
          room: true,
          status: true,
          coach: { select: { firstName: true, lastName: true } },
          group: {
            select: {
              name: true,
              members: {
                where: { tenantId },
                select: {
                  memberId: true,
                  status: true,
                  startDate: true,
                  endDate: true,
                  member: { select: { status: true } },
                },
              },
            },
          },
          attendances: { where: { tenantId }, select: { memberId: true } },
        },
        orderBy: [{ sessionDate: "desc" }, { startTime: "asc" }],
        take: 200,
      }),
      prisma.member.findMany({
        where: { tenantId, status: "ACTIVE" },
        orderBy: [{ joinedAt: "desc" }, { createdAt: "desc" }],
        take: 3,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          joinedAt: true,
          status: true,
          subscriptions: {
            where: { tenantId, status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              plan: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    activeMembers = fetchedActiveMembers;
    newMembersThisMonth = fetchedNewMembersThisMonth;
    sessionsToday = fetchedSessionsToday;

    const paymentWindow: DashboardPayment[] = fetchedPaymentWindow.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      entryType: payment.entryType as PaymentEntryTypeValue,
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate,
    }));
    recentMembers = fetchedRecentMembers.map((member) => ({
      id: member.id,
      name: `${member.firstName} ${member.lastName}`,
      initials: memberInitials(member.firstName, member.lastName),
      planName: member.subscriptions[0]?.plan?.name ?? "Sans abonnement actif",
      joinedAt: member.joinedAt,
      status: member.status === "ACTIVE" ? "Actif" : member.status,
    }));

    const paymentsToday = paymentWindow.filter((payment) => payment.paymentDate >= today && payment.paymentDate < tomorrow);
    const paymentsThisWeek = paymentWindow.filter((payment) => payment.paymentDate >= weekStart && payment.paymentDate < tomorrow);
    const paymentsThisMonth = paymentWindow.filter((payment) => payment.paymentDate >= monthStart && payment.paymentDate < tomorrow);
    const positivePaymentsToday = paymentsToday.filter((payment) => payment.amount > 0);

    revenueToday = sumPaymentAmounts(paymentsToday);
    revenueWeek = sumPaymentAmounts(paymentsThisWeek);
    revenueMonth = sumPaymentAmounts(paymentsThisMonth);
    paymentCountToday = paymentsToday.length;
    averagePaymentToday =
      positivePaymentsToday.length > 0 ? Math.round(sumPaymentAmounts(positivePaymentsToday) / positivePaymentsToday.length) : 0;
    correctionsToday = paymentsToday.filter((payment) => payment.entryType === "CORRECTION").length;
    reversalsToday = paymentsToday.filter((payment) => payment.entryType === "REVERSAL").length;

    const salesSubscriptionsToday = fetchedSalesSubscriptions.filter(
      (subscription) => subscription.createdAt >= today && subscription.createdAt < tomorrow,
    );
    const todayNewMemberIds = new Set(
      salesSubscriptionsToday
        .filter((subscription) => subscription.member.joinedAt >= today && subscription.member.joinedAt < tomorrow)
        .map((subscription) => subscription.memberId),
    );
    const monthNewMemberIds = new Set(
      fetchedSalesSubscriptions
        .filter((subscription) => subscription.member.joinedAt >= monthStart && subscription.member.joinedAt < tomorrow)
        .map((subscription) => subscription.memberId),
    );

    salesToday = salesSubscriptionsToday.reduce((sum, subscription) => sum + subscription.amount, 0);
    salesTodayCount = salesSubscriptionsToday.length;
    salesMonth = fetchedSalesSubscriptions.reduce((sum, subscription) => sum + subscription.amount, 0);
    const catalogueMonth = fetchedSalesSubscriptions.reduce((sum, subscription) => {
      const cataloguePrice = subscription.listPriceCents ?? subscription.amount + subscription.discountCents;
      return sum + Math.max(cataloguePrice, subscription.amount);
    }, 0);
    const discountMonth = fetchedSalesSubscriptions.reduce((sum, subscription) => {
      const cataloguePrice = subscription.listPriceCents ?? subscription.amount + subscription.discountCents;
      return sum + Math.max(0, cataloguePrice - subscription.amount);
    }, 0);
    const discountedSubscriptions = fetchedSalesSubscriptions.filter((subscription) => {
      const cataloguePrice = subscription.listPriceCents ?? subscription.amount + subscription.discountCents;
      return Math.max(0, cataloguePrice - subscription.amount) > 0;
    }).length;
    discountSnapshot = {
      catalogueMonth,
      discountMonth,
      discountedSubscriptions,
      discountRatePercent: catalogueMonth > 0 ? Math.round((discountMonth / catalogueMonth) * 100) : null,
    };

    const paymentCountMonth = paymentsThisMonth.filter(
      (payment) => payment.entryType === "PAYMENT" && payment.amount > 0,
    ).length;
    const paymentReceiptsMonth = fetchedReceiptWindow.filter(
      (receipt) => receipt.payment.entryType === "PAYMENT" && receipt.payment.amount > 0,
    );
    const issuedReceiptsMonth = paymentReceiptsMonth.filter((receipt) => receipt.status === "ISSUED").length;
    receiptSnapshot = {
      paymentCountMonth,
      issuedMonth: issuedReceiptsMonth,
      missingMonth: Math.max(0, paymentCountMonth - issuedReceiptsMonth),
      voidedMonth: paymentReceiptsMonth.filter((receipt) => receipt.status === "VOIDED").length,
    };

    const paidOnTodaySales = salesSubscriptionsToday.reduce(
      (sum, subscription) => sum + subscription.payments.reduce((paymentSum, payment) => paymentSum + payment.amount, 0),
      0,
    );
    remainingOnTodaySales = Math.max(0, salesToday - paidOnTodaySales);
    newSalesToday = todayNewMemberIds.size;
    renewalSalesToday = Math.max(0, salesSubscriptionsToday.length - newSalesToday);
    newSalesMonth = monthNewMemberIds.size;
    renewalSalesMonth = Math.max(0, fetchedSalesSubscriptions.length - newSalesMonth);

    const debtAgingMap = {
      recent: { label: "0-7 jours", amount: 0, subscriptions: 0, tone: "green" as const },
      warning: { label: "8-30 jours", amount: 0, subscriptions: 0, tone: "amber" as const },
      late: { label: "30+ jours", amount: 0, subscriptions: 0, tone: "red" as const },
    };

    for (const subscription of fetchedSubscriptions) {
      const paid = subscription.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const outstanding = Math.max(0, subscription.amount - paid);
      if (outstanding <= 0) continue;

      const ageInDays = Math.max(
        0,
        Math.floor((today.getTime() - subscription.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      );
      const bucket = ageInDays <= 7 ? debtAgingMap.recent : ageInDays <= 30 ? debtAgingMap.warning : debtAgingMap.late;
      bucket.amount += outstanding;
      bucket.subscriptions += 1;
    }
    debtAgingBuckets = [debtAgingMap.recent, debtAgingMap.warning, debtAgingMap.late];

    const salesByPlan = new Map<string, SalesBreakdownItem>();
    for (const subscription of fetchedSalesSubscriptions) {
      const sportName = subscription.sport?.name ?? "Acces salle";
      const key = `${subscription.plan.name}::${sportName}`;
      const existing = salesByPlan.get(key) ?? {
        label: subscription.plan.name,
        sublabel: sportName,
        amount: 0,
        subscriptions: 0,
      };
      existing.amount += subscription.amount;
      existing.subscriptions += 1;
      salesByPlan.set(key, existing);
    }
    topSalesItems = Array.from(salesByPlan.values())
      .sort((left, right) => right.amount - left.amount || right.subscriptions - left.subscriptions)
      .slice(0, 3);

    const methodStats = new Map<string, CashMethodStat>();
    for (const payment of paymentsToday) {
      const method = payment.paymentMethod?.trim() || "UNKNOWN";
      const existing = methodStats.get(method) ?? {
        method,
        label: formatPaymentMethodLabel(method),
        amount: 0,
        count: 0,
        tone: paymentMethodTone(method),
      };
      existing.amount += payment.amount;
      existing.count += 1;
      methodStats.set(method, existing);
    }
    cashMethodStats = Array.from(methodStats.values()).sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount));
    cashTrend = buildCashTrend(paymentWindow.filter((payment) => payment.paymentDate >= trendStart), trendStart, today);

    finance = computeFinanceSnapshot(fetchedSubscriptions, { now });
    const rawDebts = computeMemberDebts(fetchedSubscriptions, {
      debtThresholdCents: clubSettings.debtAlertThresholdCents,
      now,
    }).slice(0, 15);
    debts = await enrichDebtsWithReminderMeta(rawDebts, { now, tenantId });
    emailConfigured = isPaymentReminderEmailConfigured();

    const operationalSessions = fetchedSessions.map((session) => {
      const expectedMemberIds = expectedMemberIdsAtSession(session.group.members, session.sessionDate);
      const lifecycle = deriveSessionLifecycle({
        status: session.status,
        sessionDate: session.sessionDate,
        endTime: session.endTime,
        expectedMemberIds,
        attendanceMemberIds: session.attendances.map((attendance) => attendance.memberId),
        now,
      });

      return {
        id: session.id,
        groupName: session.group.name,
        coachName: session.coach ? `${session.coach.firstName} ${session.coach.lastName}` : null,
        room: session.room,
        sessionDate: session.sessionDate,
        startTime: session.startTime,
        endTime: session.endTime,
        ...lifecycle,
      };
    });

    todaySessions = operationalSessions
      .filter((session) => session.sessionDate >= today && session.sessionDate < tomorrow)
      .sort((left, right) => left.startTime.localeCompare(right.startTime))
      .slice(0, 6);

    const zeroExpectedToday = todaySessions.filter((session) => session.expectedMemberCount === 0);
    const missingCoachToday = todaySessions.filter((session) => !session.coachName);
    dataConfidenceItems = [
      ...(sessionsToday > 0 && activeMembers === 0
        ? [
            {
              id: "active-members-empty-with-sessions",
              title: "Séances sans élèves actifs",
              detail:
                "Le planning contient des séances, mais aucun membre actif n'est compté. Vérifiez les inscriptions ou les membres résiliés avant la remise au client.",
              href: "/members",
              actionLabel: "Vérifier les membres",
            },
          ]
        : []),
      ...(zeroExpectedToday.length > 0
        ? [
            {
              id: "today-sessions-without-expected-members",
              title: "Groupes sans élèves attendus",
              detail: `${zeroExpectedToday.length} séance${zeroExpectedToday.length > 1 ? "s" : ""} aujourd'hui n'a aucun élève attendu. Cela peut venir d'assignations fermées ou d'un groupe vide.`,
              href: "/groups",
              actionLabel: "Vérifier les groupes",
            },
          ]
        : []),
      ...(missingCoachToday.length > 0
        ? [
            {
              id: "today-sessions-without-coach",
              title: "Coach manquant sur le planning",
              detail: `${missingCoachToday.length} séance${missingCoachToday.length > 1 ? "s" : ""} aujourd'hui n'a pas de coach affiché.`,
              href: "/sessions",
              actionLabel: "Ouvrir le planning",
            },
          ]
        : []),
    ];

    finalizationSessions = operationalSessions
      .filter((session) => session.operationalStatus === "NEEDS_FINALIZATION")
      .sort((left, right) => {
        const dateDiff = left.sessionDate.getTime() - right.sessionDate.getTime();
        return dateDiff || left.startTime.localeCompare(right.startTime);
      })
      .slice(0, 4);

    const expiringSubscriptions = fetchedSubscriptions
      .filter((subscription) => {
        if (!subscription.endDate) return false;
        if (subscription.startDate > today) return false;
        return subscription.endDate >= today && subscription.endDate <= sevenDaysFromToday;
      })
      .sort((left, right) => {
        if (!left.endDate || !right.endDate) return 0;
        return left.endDate.getTime() - right.endDate.getTime();
      })
      .slice(0, 3);

    priorityItems = [
      ...debts.slice(0, 3).map((debt) => ({
        id: `debt-${debt.memberId}`,
        title: debt.memberName,
        detail: `${formatMoney(debt.totalDebt)} à encaisser`,
        meta: debt.partialPaid
          ? "Paiement partiel"
          : `${debt.subscriptions} abonnement${debt.subscriptions > 1 ? "s" : ""}`,
        href: `/payments/new?memberId=${debt.memberId}`,
        actionLabel: "Encaisser",
        icon: Wallet,
        tone: "red" as const,
      })),
      ...finalizationSessions.slice(0, 2).map((session) => ({
        id: `session-${session.id}`,
        title: session.groupName,
        detail: `${session.startTime} - ${session.endTime} · ${session.unmarkedCount} restant(s)`,
        meta: session.canFinalize ? "Prête à finaliser" : "Pointage incomplet",
        href: `/attendance/today?sessionId=${session.id}`,
        actionLabel: session.canFinalize ? "Finaliser" : "Pointer",
        icon: ClipboardCheck,
        tone: "amber" as const,
      })),
      ...expiringSubscriptions.slice(0, 2).map((subscription) => ({
        id: `expiry-${subscription.id}`,
        title: `${subscription.member.firstName} ${subscription.member.lastName}`,
        detail: `${subscription.plan.name} · fin le ${subscription.endDate ? formatDateFr(subscription.endDate) : ""}`,
        meta: "Échéance proche",
        href: `/members/${subscription.memberId}`,
        actionLabel: "Voir",
        icon: CalendarClock,
        tone: "blue" as const,
      })),
    ].slice(0, 6);
  } catch (error) {
    hasDataError = true;
    console.error("Dashboard degraded mode:", error);
  }

  const hasCommercialActivity =
    salesToday > 0 ||
    salesTodayCount > 0 ||
    salesMonth > 0 ||
    revenueToday !== 0 ||
    revenueMonth !== 0 ||
    remainingOnTodaySales > 0 ||
    newSalesMonth > 0 ||
    renewalSalesMonth > 0 ||
    debtAgingBuckets.some((bucket) => bucket.amount > 0 || bucket.subscriptions > 0) ||
    topSalesItems.length > 0 ||
    discountSnapshot.discountMonth > 0 ||
    discountSnapshot.discountedSubscriptions > 0 ||
    receiptSnapshot.paymentCountMonth > 0 ||
    receiptSnapshot.issuedMonth > 0 ||
    receiptSnapshot.missingMonth > 0 ||
    receiptSnapshot.voidedMonth > 0;

  const dashboardMode = resolveDashboardMode({
    defaultMode: dashboardPreferences.dashboardDefaultMode,
    role: authUser.role,
    permissions: authUser.permissions,
    queryView: dashboardParams.view,
  });
  const canSwitchDashboardView = canUseDashboardViewOverride(authUser.role, authUser.permissions);
  const dashboardVisibility = getDashboardWidgetVisibility(
    dashboardPreferences,
    dashboardMode,
    authUser.role,
    authUser.permissions,
  );

  const todayPanel = dashboardVisibility.todaySessions ? (
    <TodayWorkPanel todaySessions={todaySessions} priorityItems={priorityItems} />
  ) : null;
  const cashPanel = dashboardVisibility.cashToday ? (
    <CashRegisterPanel
      totalToday={revenueToday}
      paymentCountToday={paymentCountToday}
      averagePaymentToday={averagePaymentToday}
      weekTotal={revenueWeek}
      monthTotal={revenueMonth}
      methodStats={cashMethodStats}
      correctionsToday={correctionsToday}
      reversalsToday={reversalsToday}
    />
  ) : null;
  const dataConfidencePanel =
    dashboardVisibility.dataConfidence && dataConfidenceItems.length > 0 ? (
      <DataConfidencePanel items={dataConfidenceItems} />
    ) : null;
  const cashTrendPanel = dashboardVisibility.cashTrend ? (
    <CashTrendPanel trend={cashTrend} weekTotal={revenueWeek} />
  ) : null;
  const membersOverviewPanel = dashboardVisibility.membersOverview ? (
    <MembersOverviewPanel
      activeMembers={activeMembers}
      newMembersThisMonth={newMembersThisMonth}
      expiringSoon={finance.expiringIn7Days}
      pendingPayment={finance.debtorsCount}
      recentMembers={recentMembers}
    />
  ) : null;
  const gymOverviewPanel = gymModuleEnabled && showGymOverview ? <GymOverviewPanel {...gymStats} /> : null;
  const commercialPanel = dashboardVisibility.commercialInsights ? (
    hasCommercialActivity ? (
      <SalesSnapshotPanel
        salesToday={salesToday}
        salesTodayCount={salesTodayCount}
        salesMonth={salesMonth}
        revenueToday={revenueToday}
        remainingOnTodaySales={remainingOnTodaySales}
        newSalesToday={newSalesToday}
        renewalSalesToday={renewalSalesToday}
        newSalesMonth={newSalesMonth}
        renewalSalesMonth={renewalSalesMonth}
        debtAgingBuckets={debtAgingBuckets}
        topSalesItems={topSalesItems}
        discountSnapshot={discountSnapshot}
        receiptSnapshot={receiptSnapshot}
      />
    ) : (
      <CommercialQuietStatePanel />
    )
  ) : null;
  const detailedDebtsPanel =
    dashboardVisibility.detailedDebts && debts.length > 0 ? (
      <DashboardPanel labelledBy="dashboard-debts-title" className="min-w-0">
        <DashboardSectionHeader
          titleId="dashboard-debts-title"
          title="ImpayÃ©s dÃ©taillÃ©s"
          eyebrow="Relances"
          action={
            <Link href="/subscriptions" className="text-xs font-semibold text-[#2563EB] hover:underline">
              Abonnements
            </Link>
          }
        />
        <div className="p-3">
          <DashboardDebtsSection debts={debts} emailConfigured={emailConfigured} />
        </div>
      </DashboardPanel>
    ) : null;
  const visibleDashboardPanels = [
    todayPanel,
    cashPanel,
    dataConfidencePanel,
    cashTrendPanel,
    membersOverviewPanel,
    gymOverviewPanel,
    commercialPanel,
    detailedDebtsPanel,
  ].filter(Boolean).length;

  return (
    <main
      className="app-shell relative overflow-hidden text-[#111827] dark:bg-[#0B1220] dark:text-slate-100"
      style={{
        background:
          "radial-gradient(circle at 74% 0%, rgba(191,219,254,0.72) 0, rgba(219,234,254,0.46) 13rem, rgba(246,249,255,0) 31rem), #F6F9FF",
      }}
    >
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5">
        <header
          className="relative overflow-hidden rounded-lg bg-[#0B1220] px-4 py-4 text-white shadow-[0_18px_48px_rgba(37,99,235,0.20)] sm:px-6 lg:min-h-[11.5rem] lg:px-7 lg:py-6"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(8,22,58,0.94) 0%, rgba(12,43,104,0.78) 38%, rgba(12,44,101,0.24) 66%, rgba(7,18,48,0.50) 100%), linear-gradient(180deg, rgba(7,18,48,0.08) 0%, rgba(7,18,48,0.50) 100%), url('/we-discipline/wide-dojo-interior.webp')",
            backgroundPosition: "center 48%",
            backgroundSize: "cover",
          }}
        >
          <div className="relative z-10 flex min-h-full flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-2xl">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[#93C5FD]">
                Tableau de bord
              </p>
              <h1 className="mt-2 text-2xl font-bold leading-tight tracking-normal sm:text-4xl">
                Aujourd&apos;hui au club
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-blue-50 sm:text-base sm:leading-7">
                Les séances à pointer, les encaissements à suivre et les priorités qui demandent une action.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[32rem]">
              <div className="rounded-lg border border-white/18 bg-[#061A3D]/70 px-3 py-2.5 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur sm:px-4 sm:py-3">
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-blue-200">
                  Date
                </p>
                <p className="mt-2 text-sm font-bold capitalize text-white">{formatLongDateFr(today)}</p>
              </div>
              <div className="rounded-lg border border-white/18 bg-[#061A3D]/70 px-3 py-2.5 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur sm:px-4 sm:py-3">
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-blue-200">
                  Séances
                </p>
                <p className="mt-2 text-sm font-bold text-white">{sessionsToday} aujourd&apos;hui</p>
              </div>
              <div className="rounded-lg border border-white/18 bg-[#061A3D]/70 px-3 py-2.5 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur sm:px-4 sm:py-3">
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-blue-200">
                  Membres
                </p>
                <p className="mt-2 text-sm font-bold text-white">{activeMembers} actifs</p>
              </div>
            </div>
          </div>
        </header>

        {hasDataError ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm font-medium text-[#B45309]">
            <AlertCircle className="size-4 shrink-0" />
            Données temporairement indisponibles. Vérifiez la base et redémarrez le serveur.
          </div>
        ) : null}

        <DashboardViewSwitcher mode={dashboardMode} canSwitch={canSwitchDashboardView} />

        {visibleDashboardPanels === 0 ? (
          <EmptyDashboardConfigurationPanel isAdmin={authUser.role === "ADMIN"} />
        ) : dashboardMode === "PILOTAGE" ? (
          <>
            <DashboardGridRow variant="balanced">{[cashPanel, cashTrendPanel]}</DashboardGridRow>
            <DashboardGridRow variant="wideLeft">{[membersOverviewPanel, todayPanel]}</DashboardGridRow>
            {gymOverviewPanel}
            {dataConfidencePanel}
            {commercialPanel}
            {detailedDebtsPanel}
          </>
        ) : (
          <>
            <DashboardGridRow variant="wideLeft">{[todayPanel, cashPanel]}</DashboardGridRow>
            {dataConfidencePanel}
            <DashboardGridRow variant="balanced">{[cashTrendPanel, membersOverviewPanel]}</DashboardGridRow>
            {gymOverviewPanel}
            {detailedDebtsPanel}
          </>
        )}

      </div>
    </main>
  );
}
