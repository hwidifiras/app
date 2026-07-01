import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ListChecks,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import { DashboardDebtsSection } from "@/components/dashboard/dashboard-debts-section";
import { getClubSettings } from "@/lib/club-settings";
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
import { formatRoomLabel } from "@/lib/group-room";
import {
  deriveSessionLifecycle,
  expectedMemberIdsAtSession,
  type SessionOperationalStatus,
} from "@/lib/session-lifecycle";
import { formatMoney } from "@/lib/subscription-billing";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type IconComponent = React.ComponentType<{ className?: string }>;
type DashboardTone = "blue" | "green" | "amber" | "red" | "slate";

type DashboardMetric = {
  label: string;
  value: number | string;
  hint?: string;
  href: string;
  icon: IconComponent;
  tone: DashboardTone;
};

type TodaySession = {
  id: string;
  groupName: string;
  coachName: string | null;
  room: string;
  startTime: string;
  endTime: string;
  operationalStatus: SessionOperationalStatus;
  expectedMemberCount: number;
  checkedMemberCount: number;
  unmarkedCount: number;
  canFinalize: boolean;
};

type PriorityItem = {
  id: string;
  title: string;
  detail: string;
  meta?: string;
  href: string;
  actionLabel: string;
  icon: IconComponent;
  tone: DashboardTone;
};

const dashboardToneStyles: Record<
  DashboardTone,
  {
    icon: string;
    badge: string;
    text: string;
    soft: string;
    border: string;
  }
> = {
  blue: {
    icon: "bg-[#2563EB] text-white",
    badge: "bg-[#EFF6FF] text-[#1D4ED8]",
    text: "text-[#2563EB]",
    soft: "bg-[#EFF6FF]",
    border: "border-[#BFDBFE]",
  },
  green: {
    icon: "bg-[#10B981] text-white",
    badge: "bg-[#ECFDF5] text-[#047857]",
    text: "text-[#047857]",
    soft: "bg-[#ECFDF5]",
    border: "border-[#A7F3D0]",
  },
  amber: {
    icon: "bg-[#F59E0B] text-white",
    badge: "bg-[#FFFBEB] text-[#B45309]",
    text: "text-[#B45309]",
    soft: "bg-[#FFFBEB]",
    border: "border-[#FDE68A]",
  },
  red: {
    icon: "bg-[#EF4444] text-white",
    badge: "bg-[#FEF2F2] text-[#B91C1C]",
    text: "text-[#DC2626]",
    soft: "bg-[#FEF2F2]",
    border: "border-[#FECACA]",
  },
  slate: {
    icon: "bg-[#0B1220] text-white",
    badge: "bg-[#F1F5F9] text-[#334155]",
    text: "text-[#334155]",
    soft: "bg-[#F8FAFC]",
    border: "border-[#CBD5E1]",
  },
};

const receptionQuickLinks = [
  {
    title: "Pointer",
    description: "Présences du jour",
    href: "/attendance/today",
    icon: BadgeCheck,
    tone: "blue" as const,
  },
  {
    title: "Encaisser",
    description: "Règlement membre",
    href: "/payments/new",
    icon: Banknote,
    tone: "green" as const,
  },
  {
    title: "Inscrire",
    description: "Nouveau dossier",
    href: "/enrollment",
    icon: UserPlus,
    tone: "blue" as const,
  },
  {
    title: "Membres",
    description: "Recherche rapide",
    href: "/members",
    icon: Users,
    tone: "slate" as const,
  },
];

function DashboardPanel({
  children,
  className,
  labelledBy,
}: {
  children: React.ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn(
        "rounded-lg border border-[#D8E2F0] bg-white text-[#111827] shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100",
        className,
      )}
    >
      {children}
    </section>
  );
}

function DashboardSectionHeader({
  title,
  eyebrow,
  action,
  titleId,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  titleId?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3 dark:border-slate-800">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#2563EB] dark:text-blue-300">
            {eyebrow}
          </p>
        ) : null}
        <h2 id={titleId} className="text-base font-semibold leading-tight text-[#0B1220] dark:text-slate-50">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

function DashboardMetricCard({ metric }: { metric: DashboardMetric }) {
  const tone = dashboardToneStyles[metric.tone];
  const Icon = metric.icon;

  return (
    <Link
      href={metric.href}
      className={cn(
        "group flex min-h-[6.25rem] items-center gap-3 rounded-lg border bg-white p-3 text-[#111827] shadow-[0_6px_18px_rgba(15,23,42,0.045)] transition hover:-translate-y-0.5 hover:border-[#2563EB] hover:shadow-[0_10px_24px_rgba(37,99,235,0.12)] dark:bg-slate-950 dark:text-slate-100",
        tone.border,
      )}
      aria-label={metric.label}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tone.icon)}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium leading-tight text-[#64748B] dark:text-slate-400">
          {metric.label}
        </span>
        <span className="mt-1 block truncate text-xl font-bold leading-tight text-[#0B1220] dark:text-slate-50">
          {metric.value}
        </span>
        {metric.hint ? (
          <span className="mt-1 block text-[0.7rem] leading-snug text-[#64748B] dark:text-slate-400">
            {metric.hint}
          </span>
        ) : null}
      </span>
      <ArrowRight className="size-4 shrink-0 text-[#94A3B8] transition group-hover:translate-x-0.5 group-hover:text-[#2563EB]" />
    </Link>
  );
}

function DashboardQuickAction({
  title,
  description,
  href,
  icon: Icon,
  tone,
}: {
  title: string;
  description: string;
  href: string;
  icon: IconComponent;
  tone: DashboardTone;
}) {
  const toneStyle = dashboardToneStyles[tone];

  return (
    <Link
      href={href}
      className="group flex min-h-[4.75rem] items-center gap-3 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-[#111827] transition hover:border-[#2563EB] hover:bg-[#F8FAFC] dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
      aria-label={title}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", toneStyle.icon)}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-tight">{title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-[#64748B] dark:text-slate-400">
          {description}
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-[#94A3B8] transition group-hover:translate-x-0.5 group-hover:text-[#2563EB]" />
    </Link>
  );
}

function statusLabel(session: TodaySession): string {
  if (session.operationalStatus === "COMPLETED") return "Terminée";
  if (session.operationalStatus === "NEEDS_FINALIZATION") {
    return session.canFinalize ? "À finaliser" : "À compléter";
  }
  return "À pointer";
}

function sessionTone(session: TodaySession): DashboardTone {
  if (session.operationalStatus === "COMPLETED") return "green";
  if (session.operationalStatus === "NEEDS_FINALIZATION") return "amber";
  return "blue";
}

function sessionActionLabel(session: TodaySession): string {
  if (session.operationalStatus === "COMPLETED") return "Voir";
  if (session.canFinalize) return "Finaliser";
  return "Pointer";
}

function TodaySessionRow({ session }: { session: TodaySession }) {
  const tone = dashboardToneStyles[sessionTone(session)];
  const progress =
    session.expectedMemberCount > 0
      ? Math.min(100, Math.round((session.checkedMemberCount / session.expectedMemberCount) * 100))
      : 0;

  return (
    <li className="border-t border-[#E2E8F0] px-4 py-3 first:border-t-0 dark:border-slate-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-[#0B1220] dark:text-slate-50">{session.groupName}</p>
            <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[0.66rem] font-semibold", tone.badge)}>
              {statusLabel(session)}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#64748B] dark:text-slate-400">
            {session.startTime} - {session.endTime} · {formatRoomLabel(session.room)}
            {session.coachName ? ` · ${session.coachName}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#64748B] dark:text-slate-400">
            <span>
              {session.checkedMemberCount}/{session.expectedMemberCount} pointés
            </span>
            {session.unmarkedCount > 0 ? (
              <span className={dashboardToneStyles.amber.text}>{session.unmarkedCount} restant(s)</span>
            ) : (
              <span className={dashboardToneStyles.green.text}>Complet</span>
            )}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-slate-800">
            <div className={cn("h-full rounded-full", tone.icon)} style={{ width: `${progress}%` }} />
          </div>
        </div>
        <Link
          href={`/attendance/today?sessionId=${session.id}`}
          className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg bg-[#2563EB] px-3 text-sm font-semibold !text-white transition hover:bg-[#1D4ED8]"
        >
          {sessionActionLabel(session)}
        </Link>
      </div>
    </li>
  );
}

function PriorityQueue({ items }: { items: PriorityItem[] }) {
  return (
    <DashboardPanel labelledBy="dashboard-priority-title" className="min-w-0">
      <DashboardSectionHeader
        titleId="dashboard-priority-title"
        title="À traiter"
        eyebrow="Priorités"
        action={
          <Link href="/subscriptions" className="text-xs font-semibold text-[#2563EB] hover:underline">
            Voir tout
          </Link>
        }
      />
      {items.length === 0 ? (
        <div className="flex min-h-44 flex-col items-center justify-center px-4 py-6 text-center">
          <CheckCircle2 className="size-8 text-[#10B981]" />
          <p className="mt-2 text-sm font-semibold text-[#0B1220] dark:text-slate-50">Rien à traiter</p>
          <p className="mt-1 max-w-sm text-xs text-[#64748B] dark:text-slate-400">
            Aucun impayé prioritaire, aucune séance à finaliser et aucune échéance urgente.
          </p>
        </div>
      ) : (
        <ul>
          {items.map((item) => {
            const tone = dashboardToneStyles[item.tone];
            const Icon = item.icon;
            return (
              <li key={item.id} className="border-t border-[#E2E8F0] px-4 py-3 first:border-t-0 dark:border-slate-800">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg", tone.soft, tone.text)}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#0B1220] dark:text-slate-50">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-[#64748B] dark:text-slate-400">
                        {item.detail}
                      </span>
                      {item.meta ? (
                        <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[0.66rem] font-semibold", tone.badge)}>
                          {item.meta}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <Link
                    href={item.href}
                    className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-[#D8E2F0] bg-white px-3 text-sm font-semibold text-[#0B1220] transition hover:border-[#2563EB] hover:text-[#2563EB] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {item.actionLabel}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardPanel>
  );
}

function MoneySnapshot({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <DashboardPanel labelledBy="dashboard-money-title" className="min-w-0">
      <DashboardSectionHeader titleId="dashboard-money-title" title="Argent" eyebrow="Suivi" />
      <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-1">
        {metrics.map((metric) => (
          <DashboardMetricCard key={metric.label} metric={metric} />
        ))}
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
  let todaySessions: TodaySession[] = [];
  let finalizationSessions: TodaySession[] = [];
  let priorityItems: PriorityItem[] = [];
  let emailConfigured = false;

  const now = new Date();
  const today = utcDateOnlyForTimeZone(now);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const weekStart = startOfUtcWeek(today);
  const monthStart = startOfUtcMonth(today);
  const overdueSince = new Date(today);
  overdueSince.setUTCDate(overdueSince.getUTCDate() - 30);
  const sevenDaysFromToday = new Date(today);
  sevenDaysFromToday.setUTCDate(sevenDaysFromToday.getUTCDate() + 7);

  try {
    const clubSettings = await getClubSettings();

    const [
      fetchedActiveMembers,
      fetchedAttendanceToday,
      fetchedSessionsToday,
      fetchedRevenueToday,
      fetchedRevenueWeek,
      fetchedRevenueMonth,
      fetchedSubscriptions,
      fetchedSessions,
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
          plan: { select: { name: true } },
          payments: { select: { amount: true } },
        },
      }),
      prisma.session.findMany({
        where: {
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
                select: { memberId: true, startDate: true, endDate: true },
              },
            },
          },
          attendances: { select: { memberId: true } },
        },
        orderBy: [{ sessionDate: "desc" }, { startTime: "asc" }],
        take: 200,
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

  const moneyMetrics: DashboardMetric[] = [
    {
      label: "Aujourd'hui",
      value: formatMoney(revenueToday),
      hint: `${attendanceToday} présence${attendanceToday > 1 ? "s" : ""}`,
      href: "/payments",
      icon: Wallet,
      tone: "green",
    },
    {
      label: "Cette semaine",
      value: formatMoney(revenueWeek),
      hint: `Mois : ${formatMoney(revenueMonth)}`,
      href: "/payments",
      icon: TrendingUp,
      tone: "blue",
    },
    {
      label: "À recouvrer",
      value: formatMoney(finance.totalOutstandingCents),
      hint: `${finance.debtorsCount} membre${finance.debtorsCount > 1 ? "s" : ""}`,
      href: "/subscriptions",
      icon: AlertCircle,
      tone: finance.totalOutstandingCents > 0 ? "red" : "green",
    },
    {
      label: "Recouvrement",
      value: finance.collectionRatePercent === null ? "—" : `${finance.collectionRatePercent} %`,
      hint: `${finance.activeSubscriptionsCount} abonnement${finance.activeSubscriptionsCount > 1 ? "s" : ""} actif${finance.activeSubscriptionsCount > 1 ? "s" : ""}`,
      href: "/subscriptions",
      icon: ClipboardCheck,
      tone: "slate",
    },
  ];

  return (
    <main className="app-shell bg-[#F6F9FF] text-[#111827] dark:bg-[#0B1220] dark:text-slate-100">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
        <header className="rounded-lg bg-[#0B1220] px-4 py-4 text-white shadow-[0_12px_32px_rgba(11,18,32,0.16)] sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#93C5FD]">
                Tableau de bord
              </p>
              <h1 className="mt-1 text-2xl font-bold leading-tight tracking-normal sm:text-3xl">
                Aujourd&apos;hui au club
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Les séances à pointer, les encaissements à suivre et les priorités qui demandent une action.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[30rem]">
              <div className="rounded-lg border border-white/10 bg-white/8 px-3 py-2">
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Date
                </p>
                <p className="mt-1 text-sm font-semibold capitalize text-white">{formatLongDateFr(today)}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/8 px-3 py-2">
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Séances
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{sessionsToday} aujourd&apos;hui</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/8 px-3 py-2">
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Membres
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{activeMembers} actifs</p>
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

        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,0.75fr)]">
          <DashboardPanel labelledBy="dashboard-today-title" className="min-w-0">
            <DashboardSectionHeader
              titleId="dashboard-today-title"
              title="Séances du jour"
              eyebrow="Aujourd'hui"
              action={
                <Link href="/attendance/today" className="text-xs font-semibold text-[#2563EB] hover:underline">
                  Ouvrir le pointage
                </Link>
              }
            />
            {todaySessions.length === 0 ? (
              <div className="flex min-h-52 flex-col items-center justify-center px-4 py-6 text-center">
                <CalendarCheck2 className="size-9 text-[#10B981]" />
                <p className="mt-2 text-sm font-semibold text-[#0B1220] dark:text-slate-50">
                  Aucune séance aujourd&apos;hui
                </p>
                <p className="mt-1 max-w-sm text-xs text-[#64748B] dark:text-slate-400">
                  Le planning du jour est vide ou toutes les séances ont été annulées.
                </p>
              </div>
            ) : (
              <ul>
                {todaySessions.map((session) => (
                  <TodaySessionRow key={session.id} session={session} />
                ))}
              </ul>
            )}
          </DashboardPanel>

          <DashboardPanel labelledBy="dashboard-actions-title" className="min-w-0">
            <DashboardSectionHeader titleId="dashboard-actions-title" title="Actions rapides" eyebrow="Réception" />
            <div className="grid gap-2 p-3 sm:grid-cols-2">
              {receptionQuickLinks.map((item) => (
                <DashboardQuickAction key={item.href} {...item} />
              ))}
            </div>
          </DashboardPanel>
        </section>

        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
          <PriorityQueue items={priorityItems} />
          <MoneySnapshot metrics={moneyMetrics} />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Repères du club">
          <DashboardMetricCard
            metric={{
              label: "Présences",
              value: attendanceToday,
              hint: `${sessionsToday} séance${sessionsToday > 1 ? "s" : ""} aujourd'hui`,
              href: "/attendance/today",
              icon: BadgeCheck,
              tone: "blue",
            }}
          />
          <DashboardMetricCard
            metric={{
              label: "Échéances 7 jours",
              value: finance.expiringIn7Days,
              hint: "Abonnements à surveiller",
              href: "/subscriptions",
              icon: CalendarClock,
              tone: finance.expiringIn7Days > 0 ? "amber" : "green",
            }}
          />
          <DashboardMetricCard
            metric={{
              label: "Partiels",
              value: finance.partialPayersCount,
              hint: "Paiements incomplets",
              href: "/subscriptions",
              icon: ListChecks,
              tone: finance.partialPayersCount > 0 ? "amber" : "green",
            }}
          />
          <DashboardMetricCard
            metric={{
              label: "Membres actifs",
              value: activeMembers,
              hint: "Dossiers ouverts",
              href: "/members",
              icon: Users,
              tone: "slate",
            }}
          />
        </section>

        <DashboardPanel labelledBy="dashboard-debts-title" className="min-w-0">
          <DashboardSectionHeader
            titleId="dashboard-debts-title"
            title="Impayés détaillés"
            eyebrow="Relances"
            action={
              debts.length > 0 ? (
                <Link href="/subscriptions" className="text-xs font-semibold text-[#2563EB] hover:underline">
                  Abonnements
                </Link>
              ) : null
            }
          />
          <div className="p-3">
            {debts.length === 0 ? (
              <div className="flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed border-[#CFE0F5] bg-[#F8FAFC] px-4 text-center dark:border-slate-700 dark:bg-slate-900">
                <CheckCircle2 className="size-8 text-[#10B981]" />
                <p className="mt-2 text-sm font-semibold text-[#0B1220] dark:text-slate-50">
                  Aucun impayé prioritaire
                </p>
                <p className="mt-1 text-xs text-[#64748B] dark:text-slate-400">
                  Tous les soldes sont sous le seuil d&apos;alerte configuré.
                </p>
              </div>
            ) : (
              <DashboardDebtsSection debts={debts} emailConfigured={emailConfigured} />
            )}
          </div>
        </DashboardPanel>
      </div>
    </main>
  );
}
