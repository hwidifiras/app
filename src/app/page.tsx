import { prisma } from "@/lib/prisma";
import { getClubSettings } from "@/lib/club-settings";
import Link from "next/link";
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  CalendarClock,
  ClipboardCheck,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { utcDateOnlyForTimeZone } from "@/lib/dates";

import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardDebtsSection } from "@/components/dashboard/dashboard-debts-section";
import {
  computeFinanceSnapshot,
  computeMemberDebts,
  startOfUtcMonth,
  startOfUtcWeek,
} from "@/lib/dashboard-finance";
import { enrichDebtsWithReminderMeta } from "@/lib/payment-reminders";
import { isPaymentReminderEmailConfigured } from "@/lib/email";
import { formatMoney } from "@/lib/subscription-billing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type KpiCardProps = {
  label: string;
  value: number | string;
  hint?: string;
  icon: React.ReactNode;
  color: string;
  href?: string;
};

function KpiCard({ label, value, hint, icon, color, href }: KpiCardProps) {
  const content = (
    <Card
      size="sm"
      className={cn("shadow-sm transition active:scale-[0.98]", href && "hover:border-primary/30 hover:shadow-md")}
    >
      <CardContent className="flex items-center gap-2 p-2.5 sm:gap-3 sm:p-3.5">
        <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-9", color)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.62rem] font-medium leading-tight text-muted-foreground sm:text-xs">{label}</p>
          <p className="truncate text-base font-bold leading-tight tracking-tight text-foreground sm:text-xl">{value}</p>
          {hint ? <p className="mt-0.5 text-[0.6rem] text-muted-foreground sm:text-[0.65rem]">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block min-h-[2.85rem] touch-manipulation" aria-label={label}>
      {content}
    </Link>
  );
}

type QuickActionProps = {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
};

function QuickActionLink({ title, description, href, icon: Icon, tone }: QuickActionProps) {
  return (
    <Link href={href} className="quick-action-btn" aria-label={title}>
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-9", tone)}>
        <Icon className="size-4 text-white" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.72rem] font-semibold leading-tight text-foreground sm:text-sm">{title}</span>
        <span className="mt-0.5 hidden text-[0.65rem] leading-snug text-muted-foreground md:block">{description}</span>
      </span>
    </Link>
  );
}

const financeQuickLinks = [
  {
    title: "Encaisser",
    description: "Enregistrer un paiement ou solder un abonnement.",
    href: "/payments/new",
    icon: Banknote,
    tone: "bg-emerald-600",
  },
  {
    title: "Paiements reçus",
    description: "Historique des encaissements et filtres.",
    href: "/payments",
    icon: Wallet,
    tone: "bg-amber-500",
  },
  {
    title: "Abonnements",
    description: "Suivi des forfaits actifs et impayés.",
    href: "/subscriptions",
    icon: ClipboardCheck,
    tone: "bg-indigo-600",
  },
  {
    title: "Inscription",
    description: "Nouveau membre avec abonnement et premier versement.",
    href: "/enrollment",
    icon: UserPlus,
    tone: "bg-sky-500",
  },
];

export default async function Home() {
  let hasDataError = false;
  let activeMembers = 0;
  let attendanceToday = 0;
  let revenueToday = 0;
  let revenueWeek = 0;
  let revenueMonth = 0;
  let finance = {
    totalOutstandingCents: 0,
    debtorsCount: 0,
    partialPayersCount: 0,
    collectionRatePercent: null as number | null,
    expiringIn7Days: 0,
    activeSubscriptionsCount: 0,
  };
  let debts: Awaited<ReturnType<typeof enrichDebtsWithReminderMeta>> = [];
  let emailConfigured = false;

  try {
    const clubSettings = await getClubSettings();
    const now = new Date();
    const today = utcDateOnlyForTimeZone(now);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const weekStart = startOfUtcWeek(today);
    const monthStart = startOfUtcMonth(today);

    const [
      fetchedActiveMembers,
      fetchedAttendanceToday,
      fetchedRevenueToday,
      fetchedRevenueWeek,
      fetchedRevenueMonth,
      fetchedSubscriptions,
    ] = await Promise.all([
      prisma.member.count({ where: { status: "ACTIVE" } }),
      prisma.attendance.count({
        where: {
          status: { in: ["PRESENT", "OVERRIDE"] },
          session: { sessionDate: { gte: today, lt: tomorrow } },
        },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { paymentDate: { gte: today, lt: tomorrow } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { paymentDate: { gte: weekStart, lt: tomorrow } },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { paymentDate: { gte: monthStart, lt: tomorrow } },
      }),
      prisma.memberSubscription.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          amount: true,
          memberId: true,
          status: true,
          startDate: true,
          endDate: true,
          member: { select: { firstName: true, lastName: true, phone: true } },
          payments: { select: { amount: true } },
        },
      }),
    ]);

    activeMembers = fetchedActiveMembers;
    attendanceToday = fetchedAttendanceToday;
    revenueToday = fetchedRevenueToday._sum.amount ?? 0;
    revenueWeek = fetchedRevenueWeek._sum.amount ?? 0;
    revenueMonth = fetchedRevenueMonth._sum.amount ?? 0;

    finance = computeFinanceSnapshot(fetchedSubscriptions, { now });
    const rawDebts = computeMemberDebts(fetchedSubscriptions, {
      debtThresholdCents: clubSettings.debtAlertThresholdCents,
      now,
    }).slice(0, 15);
    debts = await enrichDebtsWithReminderMeta(rawDebts, { now });
    emailConfigured = isPaymentReminderEmailConfigured();
  } catch (error) {
    hasDataError = true;
    console.error("Dashboard degraded mode:", error);
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Pilotage"
        title="Tableau de bord finance"
        description="Impayés, encaissements et abonnements à relancer — actions rapides pour la réception."
      />

      {hasDataError ? (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
          Données temporairement indisponibles. Vérifiez la base et redémarrez le serveur.
        </div>
      ) : null}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Indicateurs financiers
        </h2>
        <div className="kpi-grid">
          <KpiCard
            label="Impayés (actifs)"
            value={formatMoney(finance.totalOutstandingCents)}
            hint={`${finance.debtorsCount} membre${finance.debtorsCount > 1 ? "s" : ""}`}
            icon={<AlertCircle className="size-4 text-white sm:size-5" />}
            color="bg-[var(--danger)]"
            href="/subscriptions"
          />
          <KpiCard
            label="CA du mois"
            value={formatMoney(revenueMonth)}
            hint={`Semaine : ${formatMoney(revenueWeek)}`}
            icon={<TrendingUp className="size-4 text-white sm:size-5" />}
            color="bg-emerald-600"
            href="/payments"
          />
          <KpiCard
            label="CA du jour"
            value={formatMoney(revenueToday)}
            icon={<Wallet className="size-4 text-white sm:size-5" />}
            color="bg-amber-500"
            href="/payments/new"
          />
          <KpiCard
            label="Recouvrement"
            value={finance.collectionRatePercent === null ? "—" : `${finance.collectionRatePercent} %`}
            hint={`${finance.activeSubscriptionsCount} abo actifs`}
            icon={<ClipboardCheck className="size-4 text-white sm:size-5" />}
            color="bg-indigo-600"
            href="/subscriptions"
          />
          <KpiCard
            label="Expire sous 7 j"
            value={finance.expiringIn7Days}
            icon={<CalendarClock className="size-4 text-white sm:size-5" />}
            color="bg-orange-500"
            href="/subscriptions"
          />
          <KpiCard
            label="Paiements partiels"
            value={finance.partialPayersCount}
            hint="Solde restant à encaisser"
            icon={<Banknote className="size-4 text-white sm:size-5" />}
            color="bg-[var(--warning)]"
            href="/payments/new"
          />
        </div>
      </section>

      <section className="mt-4 sm:mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Actions rapides
        </h2>
        <div className="quick-actions-grid">
          {financeQuickLinks.map((item) => (
            <QuickActionLink key={item.href} {...item} />
          ))}
        </div>
      </section>

      <section className="mt-4 sm:mt-6">
        <Card size="sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-semibold sm:text-base">Impayés à relancer</CardTitle>
            {debts.length > 0 ? (
              <Link href="/payments/new" className="text-xs font-medium text-[var(--primary)] hover:underline">
                Encaisser →
              </Link>
            ) : null}
          </CardHeader>
          <CardContent className="pt-0">
            {debts.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">Aucun impayé au-dessus du seuil configuré.</p>
            ) : (
              <DashboardDebtsSection debts={debts} emailConfigured={emailConfigured} />
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 sm:mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Activité du jour
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <KpiCard
            label="Membres actifs"
            value={activeMembers}
            icon={<Users className="size-4 text-white sm:size-5" />}
            color="bg-[var(--primary)]"
            href="/members"
          />
          <KpiCard
            label="Présences aujourd'hui"
            value={attendanceToday}
            icon={<BadgeCheck className="size-4 text-white sm:size-5" />}
            color="bg-sky-500"
            href="/attendance/today"
          />
          <KpiCard
            label="Pointer"
            value="Ouvrir"
            icon={<BadgeCheck className="size-4 text-white sm:size-5" />}
            color="bg-rose-500"
            href="/attendance/today"
          />
        </div>
      </section>
    </main>
  );
}
