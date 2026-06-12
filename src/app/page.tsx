import { prisma } from "@/lib/prisma";
import { getClubSettings } from "@/lib/club-settings";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarClock,
  CalendarDays,
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
      className={cn(
        "h-full min-h-[5.75rem] shadow-sm transition active:scale-[0.98]",
        href && "hover:border-primary/30 hover:shadow-md",
      )}
    >
      <CardContent className="flex h-full items-center gap-2 p-2.5 sm:gap-3 sm:p-3.5">
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
    <Link href={href} className="block h-full touch-manipulation" aria-label={label}>
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
    <Link
      href={href}
      className="group flex h-full min-h-[4.75rem] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 transition hover:border-[var(--primary)]/35 hover:bg-[var(--surface-soft)]"
      aria-label={title}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon className="size-4 text-white" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-tight text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{description}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--primary)]" />
    </Link>
  );
}

const receptionQuickLinks = [
  {
    title: "Pointer les séances",
    description: "Marquer les présences et absences du jour.",
    href: "/attendance/today",
    icon: BadgeCheck,
    tone: "bg-rose-500",
  },
  {
    title: "Encaisser",
    description: "Enregistrer un règlement membre.",
    href: "/payments/new",
    icon: Banknote,
    tone: "bg-emerald-600",
  },
  {
    title: "Nouvelle inscription",
    description: "Créer le dossier, l'abonnement et le groupe.",
    href: "/enrollment",
    icon: UserPlus,
    tone: "bg-sky-500",
  },
  {
    title: "Consulter les membres",
    description: "Rechercher ou ouvrir un dossier membre.",
    href: "/members",
    icon: Users,
    tone: "bg-indigo-600",
  },
];

export default async function Home() {
  let hasDataError = false;
  let activeMembers = 0;
  let attendanceToday = 0;
  let sessionsToday = 0;
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
      fetchedSessionsToday,
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
      prisma.session.count({
        where: {
          sessionDate: { gte: today, lt: tomorrow },
          status: { not: "CANCELLED" },
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
    sessionsToday = fetchedSessionsToday;
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
        title="Tableau de bord"
        description="Les priorités financières et l'activité du club, réunies dans une vue de travail."
      />

      {hasDataError ? (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
          Données temporairement indisponibles. Vérifiez la base et redémarrez le serveur.
        </div>
      ) : null}

      <section aria-labelledby="dashboard-overview-title">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          <span id="dashboard-overview-title">Vue d&apos;ensemble</span>
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Impayés à recouvrer"
            value={formatMoney(finance.totalOutstandingCents)}
            hint={`${finance.debtorsCount} membre${finance.debtorsCount > 1 ? "s" : ""}`}
            icon={<AlertCircle className="size-4 text-white sm:size-5" />}
            color="bg-[var(--danger)]"
            href="/subscriptions"
          />
          <KpiCard
            label="CA du mois"
            value={formatMoney(revenueMonth)}
            hint={`Cette semaine : ${formatMoney(revenueWeek)}`}
            icon={<TrendingUp className="size-4 text-white sm:size-5" />}
            color="bg-emerald-600"
            href="/payments"
          />
          <KpiCard
            label="Taux de recouvrement"
            value={finance.collectionRatePercent === null ? "—" : `${finance.collectionRatePercent} %`}
            hint={`${finance.activeSubscriptionsCount} abonnement${finance.activeSubscriptionsCount > 1 ? "s" : ""} actif${finance.activeSubscriptionsCount > 1 ? "s" : ""}`}
            icon={<ClipboardCheck className="size-4 text-white sm:size-5" />}
            color="bg-indigo-600"
            href="/subscriptions"
          />
          <KpiCard
            label="Échéances sous 7 jours"
            value={finance.expiringIn7Days}
            icon={<CalendarClock className="size-4 text-white sm:size-5" />}
            color="bg-orange-500"
            href="/subscriptions"
          />
        </div>
      </section>

      <section className="mt-4 sm:mt-6" aria-labelledby="dashboard-operations-title">
        <h2
          id="dashboard-operations-title"
          className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          Opérations du jour
        </h2>
        <div className="grid items-stretch gap-4 xl:grid-cols-2">
          <section className="min-w-0" aria-labelledby="dashboard-actions-title">
            <Card size="sm" className="h-full">
              <CardHeader className="border-b pb-3">
                <CardTitle id="dashboard-actions-title">Actions rapides</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 pt-0 sm:grid-cols-2">
                {receptionQuickLinks.map((item) => (
                  <QuickActionLink key={item.href} {...item} />
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="min-w-0" aria-labelledby="dashboard-activity-title">
            <Card size="sm" className="h-full">
              <CardHeader className="border-b pb-3">
                <CardTitle id="dashboard-activity-title">Activité et repères</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 pt-0">
                <KpiCard
                  label="Séances"
                  value={sessionsToday}
                  icon={<CalendarDays className="size-4 text-white" />}
                  color="bg-violet-600"
                  href="/attendance/today"
                />
                <KpiCard
                  label="Présences"
                  value={attendanceToday}
                  icon={<BadgeCheck className="size-4 text-white" />}
                  color="bg-sky-500"
                  href="/attendance/today"
                />
                <KpiCard
                  label="Encaissé aujourd'hui"
                  value={formatMoney(revenueToday)}
                  icon={<Wallet className="size-4 text-white" />}
                  color="bg-emerald-600"
                  href="/payments"
                />
                <KpiCard
                  label="Membres actifs"
                  value={activeMembers}
                  icon={<Users className="size-4 text-white" />}
                  color="bg-[var(--primary)]"
                  href="/members"
                />
              </CardContent>
            </Card>
          </section>
        </div>
      </section>

      <section className="mt-4 min-w-0 sm:mt-6" aria-labelledby="dashboard-debts-title">
        <Card size="sm">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b pb-3">
            <div>
              <CardTitle id="dashboard-debts-title" className="text-sm font-semibold sm:text-base">
                Impayés à traiter
              </CardTitle>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                {finance.debtorsCount === 0
                  ? "Aucun membre à relancer."
                  : `${finance.debtorsCount} membre${finance.debtorsCount > 1 ? "s" : ""} · ${finance.partialPayersCount} paiement${finance.partialPayersCount > 1 ? "s" : ""} partiel${finance.partialPayersCount > 1 ? "s" : ""}`}
              </p>
            </div>
            {debts.length > 0 ? (
              <Link href="/subscriptions" className="btn btn-ghost btn-sm">
                Voir les abonnements
              </Link>
            ) : null}
          </CardHeader>
          <CardContent className="pt-0">
            {debts.length === 0 ? (
              <div className="flex min-h-28 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-soft)]/45 px-4 text-center">
                <BadgeCheck className="size-7 text-[var(--success)]" />
                <p className="mt-2 text-sm font-semibold">Aucun impayé prioritaire</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Tous les soldes sont sous le seuil d&apos;alerte configuré.
                </p>
              </div>
            ) : (
              <DashboardDebtsSection debts={debts} emailConfigured={emailConfigured} />
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
