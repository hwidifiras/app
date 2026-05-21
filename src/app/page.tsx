import { prisma } from "@/lib/prisma";
import { getClubSettings } from "@/lib/club-settings";
import Link from "next/link";
import { Activity, BadgeCheck, CalendarPlus, ClipboardCheck, UserPlus, Users, Wallet } from "lucide-react";
import { utcDateOnlyForTimeZone } from "@/lib/dates";

import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardDebtsTable } from "@/components/dashboard/dashboard-debts-table";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type KpiCardProps = {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  href?: string;
};

function KpiCard({ label, value, icon, color, href }: KpiCardProps) {
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

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

const quickLinks = [
  {
    title: "Créer un membre",
    description: "Inscription complète avec groupe, abonnement et premier paiement.",
    href: "/members/new",
    icon: UserPlus,
    tone: "bg-sky-500",
  },
  {
    title: "Nouveau paiement",
    description: "Encaisser une avance ou solder un abonnement existant.",
    href: "/payments/new",
    icon: Wallet,
    tone: "bg-emerald-600",
  },
  {
    title: "Planifier une séance",
    description: "Ouvrir le planning et ajuster les séances de la semaine.",
    href: "/sessions",
    icon: CalendarPlus,
    tone: "bg-indigo-600",
  },
  {
    title: "Pointage",
    description: "Contrôler les présences du jour avec les règles d'abonnement.",
    href: "/attendance/today",
    icon: BadgeCheck,
    tone: "bg-rose-600",
  },
];

export default async function Home() {
  let hasSportDataError = false;
  let activeMembers = 0;
  let resignedMembers = 0;
  let activeSports = 0;
  let totalSports = 0;
  let activeCoaches = 0;
  let totalCoaches = 0;
  let activeSubscriptions = 0;
  let attendanceToday = 0;
  let revenueToday = 0;
  let debts: Array<{ memberId: string; memberName: string; phone: string; totalDebt: number; subscriptions: number }> = [];

  let debtThresholdCents = 0;

  try {
    const clubSettings = await getClubSettings();
    debtThresholdCents = clubSettings.debtAlertThresholdCents;
    const today = utcDateOnlyForTimeZone(new Date());
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const [
      fetchedActiveMembers,
      fetchedResignedMembers,
      fetchedActiveSports,
      fetchedTotalSports,
      fetchedActiveCoaches,
      fetchedTotalCoaches,
      fetchedActiveSubscriptions,
      fetchedAttendanceToday,
      fetchedRevenueToday,
      fetchedSubscriptions,
    ] = await Promise.all([
      prisma.member.count({ where: { status: "ACTIVE" } }),
      prisma.member.count({ where: { status: "ARCHIVED" } }),
      prisma.sport.count({ where: { isActive: true } }),
      prisma.sport.count(),
      prisma.coach.count({ where: { isActive: true } }),
      prisma.coach.count(),
      prisma.memberSubscription.count({
        where: {
          status: "ACTIVE",
          startDate: { lte: new Date() },
          OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
          remainingSessions: { gt: 0 },
        },
      }),
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
      prisma.memberSubscription.findMany({
        select: {
          id: true,
          amount: true,
          memberId: true,
          member: { select: { firstName: true, lastName: true, phone: true } },
          payments: { select: { amount: true } },
        },
      }),
    ]);

    activeMembers = fetchedActiveMembers;
    resignedMembers = fetchedResignedMembers;
    activeSports = fetchedActiveSports;
    totalSports = fetchedTotalSports;
    activeCoaches = fetchedActiveCoaches;
    totalCoaches = fetchedTotalCoaches;
    activeSubscriptions = fetchedActiveSubscriptions;
    attendanceToday = fetchedAttendanceToday;
    revenueToday = fetchedRevenueToday._sum.amount ?? 0;

    const debtMap = new Map<string, { memberId: string; memberName: string; phone: string; totalDebt: number; subscriptions: number }>();
    for (const sub of fetchedSubscriptions) {
      const totalPaid = sub.payments.reduce((sum, p) => sum + p.amount, 0);
      const outstanding = Math.max(0, sub.amount - totalPaid);
      if (outstanding <= 0) continue;
      const key = sub.memberId;
      const entry = debtMap.get(key) ?? {
        memberId: sub.memberId,
        memberName: `${sub.member.firstName} ${sub.member.lastName}`,
        phone: sub.member.phone,
        totalDebt: 0,
        subscriptions: 0,
      };
      entry.totalDebt += outstanding;
      entry.subscriptions += 1;
      debtMap.set(key, entry);
    }

    debts = Array.from(debtMap.values())
      .filter((d) => debtThresholdCents <= 0 || d.totalDebt >= debtThresholdCents)
      .sort((a, b) => b.totalDebt - a.totalDebt)
      .slice(0, 10);
  } catch (error) {
    hasSportDataError = true;
    console.error("Dashboard degraded mode due to Prisma model mismatch:", error);

    const [fetchedActiveMembers, fetchedResignedMembers] = await Promise.all([
      prisma.member.count({ where: { status: "ACTIVE" } }),
      prisma.member.count({ where: { status: "ARCHIVED" } }),
    ]);

    activeMembers = fetchedActiveMembers;
    resignedMembers = fetchedResignedMembers;
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Vue d'ensemble"
        title="Dashboard réception"
        description="Pilotage rapide des actions quotidiennes du front desk."
      />

      {hasSportDataError ? (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200">
          Données sports/coachs temporairement indisponibles. Exécutez{" "}
          <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs dark:bg-amber-500/25">npm run prisma:generate</code> puis redémarrez.
        </div>
      ) : null}

      <section className="kpi-grid">
        <KpiCard label="Membres actifs" value={activeMembers} icon={<Users className="size-4 text-white sm:size-5" />} color="bg-[var(--primary)]" href="/members" />
        <KpiCard label="CA du jour" value={formatCurrency(revenueToday)} icon={<Wallet className="size-4 text-white sm:size-5" />} color="bg-amber-500" href="/payments" />
        <KpiCard label="Séances pointées" value={attendanceToday} icon={<Activity className="size-4 text-white sm:size-5" />} color="bg-sky-500" href="/attendance/today" />
        <KpiCard label="Abonnements actifs" value={activeSubscriptions} icon={<ClipboardCheck className="size-4 text-white sm:size-5" />} color="bg-rose-500" href="/subscriptions" />
      </section>

      <section className="mt-4 sm:mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-sm sm:normal-case sm:tracking-normal">
          Actions rapides
        </h2>
        <div className="quick-actions-grid">
          {quickLinks.map((item) => (
            <QuickActionLink key={item.href} {...item} />
          ))}
        </div>
        <p className="mt-2.5 text-[0.65rem] leading-relaxed text-muted-foreground sm:mt-3 sm:text-xs">
          Membres résiliés: {resignedMembers} · Sports actifs: {activeSports}/{totalSports} · Coachs actifs:{" "}
          {activeCoaches}/{totalCoaches}
        </p>
      </section>

      <section className="mt-4 sm:mt-6">
        <Card size="sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold sm:text-base">Dettes en cours</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {debts.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">Aucune dette en cours.</p>
            ) : (
              <DashboardDebtsTable debts={debts} />
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}


