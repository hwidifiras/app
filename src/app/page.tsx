import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  RotateCcw,
  UserPlus,
  UsersRound,
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
import {
  deriveSessionLifecycle,
  expectedMemberIdsAtSession,
} from "@/lib/session-lifecycle";
import { formatMoney } from "@/lib/subscription-billing";
import {
  DashboardPanel,
  DashboardSectionHeader,
  dashboardToneStyles,
  type DashboardTone,
} from "@/components/dashboard/dashboard-ui";
import {
  TodayWorkPanel,
  type PriorityItem,
  type TodaySession,
} from "@/components/dashboard/dashboard-today-panel";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PaymentEntryTypeValue = "PAYMENT" | "CORRECTION" | "REVERSAL";

type DashboardPayment = {
  id: string;
  amount: number;
  entryType: PaymentEntryTypeValue;
  paymentMethod: string | null;
  paymentDate: Date;
};

type CashMethodStat = {
  method: string;
  label: string;
  amount: number;
  count: number;
  tone: DashboardTone;
};

type CashTrendDay = {
  key: string;
  label: string;
  amount: number;
  isToday: boolean;
};

type RecentMemberPreview = {
  id: string;
  name: string;
  initials: string;
  planName: string;
  joinedAt: Date;
  status: string;
};

function CashRegisterPanel({
  totalToday,
  paymentCountToday,
  averagePaymentToday,
  weekTotal,
  monthTotal,
  methodStats,
  correctionsToday,
  reversalsToday,
}: {
  totalToday: number;
  paymentCountToday: number;
  averagePaymentToday: number;
  weekTotal: number;
  monthTotal: number;
  methodStats: CashMethodStat[];
  correctionsToday: number;
  reversalsToday: number;
}) {
  const maxMethodAmount = Math.max(1, ...methodStats.map((stat) => Math.abs(stat.amount)));
  const hasAdjustments = correctionsToday + reversalsToday > 0;

  return (
    <DashboardPanel labelledBy="dashboard-cash-title" className="min-w-0">
      <DashboardSectionHeader
        titleId="dashboard-cash-title"
        title="Caisse aujourd'hui"
        eyebrow="Encaissements"
        action={
          <Link href="/payments/new" className="text-xs font-semibold text-[#2563EB] hover:underline">
            Encaisser
          </Link>
        }
      />
      <div className="p-3">
        <Link
          href="/payments"
          className="group flex items-center gap-3 rounded-lg border border-[#A7F3D0] bg-[linear-gradient(135deg,#ECFDF5_0%,#F0FDFA_58%,#E0F2FE_100%)] p-4 text-[#0B1220] transition hover:border-[#10B981]"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#10B981] text-white">
            <Wallet className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold uppercase text-[#047857]">Encaisse net</span>
            <span className="mt-1 block text-2xl font-bold leading-tight">{formatMoney(totalToday)}</span>
            <span className="mt-1 block text-xs text-[#64748B]">
              {paymentCountToday} mouvement{paymentCountToday > 1 ? "s" : ""} aujourd&apos;hui
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-[#64748B] transition group-hover:translate-x-0.5 group-hover:text-[#047857]" />
        </Link>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[#64748B]">Panier moyen</p>
            <p className="mt-1 text-sm font-bold text-[#0B1220]">{formatMoney(averagePaymentToday)}</p>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[#64748B]">Semaine</p>
            <p className="mt-1 text-sm font-bold text-[#0B1220]">{formatMoney(weekTotal)}</p>
          </div>
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-[#64748B]">Mois</p>
            <p className="mt-1 text-sm font-bold text-[#0B1220]">{formatMoney(monthTotal)}</p>
          </div>
        </div>

        {methodStats.length === 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs">
            <span className="font-semibold uppercase tracking-[0.12em] text-[#64748B]">Par mode</span>
            <span className="text-[#64748B]">Aucun mouvement aujourd&apos;hui</span>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-[#E2E8F0] p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#64748B]">Par mode</p>
            <div className="space-y-3">
              {methodStats.map((stat) => {
                const tone = dashboardToneStyles[stat.amount < 0 ? "red" : stat.tone];
                const width = Math.max(6, Math.round((Math.abs(stat.amount) / maxMethodAmount) * 100));

                return (
                  <div key={stat.method}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                      <span className="truncate font-medium text-[#0B1220]">{stat.label}</span>
                      <span className={cn("shrink-0 font-semibold", tone.text)}>
                        {formatMoney(stat.amount)}
                      </span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-[#E2E8F0]"
                      aria-label={`${stat.label}: ${formatMoney(stat.amount)} sur ${stat.count} mouvement${stat.count > 1 ? "s" : ""}`}
                    >
                      <div className={cn("h-full rounded-full", tone.icon)} style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {hasAdjustments ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-xs font-medium text-[#B45309]">
            <RotateCcw className="size-3.5 shrink-0" />
            {`${correctionsToday} correction(s), ${reversalsToday} annulation(s) aujourd'hui`}
          </div>
        ) : null}
      </div>
    </DashboardPanel>
  );
}

function CashTrendPanel({ trend, weekTotal }: { trend: CashTrendDay[]; weekTotal: number }) {
  const maxAmount = Math.max(1, ...trend.map((day) => Math.abs(day.amount)));

  return (
    <DashboardPanel labelledBy="dashboard-cash-trend-title" className="min-w-0">
      <DashboardSectionHeader
        titleId="dashboard-cash-trend-title"
        title="Encaissements 7 jours"
        eyebrow="Tendance"
        action={
          <Link href="/payments" className="text-xs font-semibold text-[#2563EB] hover:underline">
            Détail
          </Link>
        }
      />
      <div className="p-3">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs text-[#64748B]">Total semaine courante</p>
            <p className="mt-1 text-2xl font-bold leading-tight text-[#0B1220]">{formatMoney(weekTotal)}</p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#EFF6FF] px-2.5 py-1.5 text-xs font-semibold text-[#1D4ED8]">
            <BarChart3 className="size-3.5" />
            Net journalier
          </div>
        </div>

        <div className="relative h-56 overflow-hidden rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 pb-3 pt-4">
          <div className="absolute inset-x-3 top-5 bottom-10 flex flex-col justify-between" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, index) => (
              <span key={index} className="border-t border-[#DDE7F4]" />
            ))}
          </div>
          <div className="relative flex h-full items-end gap-2">
            {trend.map((day) => {
              const height = day.amount === 0 ? 4 : Math.max(12, Math.round((Math.abs(day.amount) / maxAmount) * 152));
              const tone = day.amount < 0 ? dashboardToneStyles.red : day.isToday ? dashboardToneStyles.green : dashboardToneStyles.blue;

              return (
                <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <div className="flex h-40 w-full items-end justify-center">
                    <div
                      className={cn("w-full max-w-10 rounded-t-md shadow-[0_8px_18px_rgba(37,99,235,0.18)]", tone.icon)}
                      style={{ height: `${height}px` }}
                      aria-label={`${day.label}: ${formatMoney(day.amount)}`}
                      title={`${day.label}: ${formatMoney(day.amount)}`}
                    />
                  </div>
                  <p className="w-full truncate text-center text-[0.66rem] font-medium text-[#64748B]">{day.label}</p>
                </div>
              );
            })}
          </div>
        </div>
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

function sumPaymentAmounts(payments: Array<{ amount: number }>) {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatTrendLabel(date: Date) {
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
  });
}

function memberInitials(firstName: string, lastName: string) {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase() || "M";
}

function formatPaymentMethodLabel(method: string | null) {
  const normalized = method?.trim().toUpperCase();

  switch (normalized) {
    case "CASH":
      return "Espèces";
    case "CARD":
      return "Carte";
    case "BANK_TRANSFER":
    case "TRANSFER":
      return "Virement";
    case "CHECK":
      return "Chèque";
    case "REPRISE_EXCEL":
    case "REPRISE_PAPIER":
      return "Reprise";
    case "UNKNOWN":
      return "Non renseigné";
    default:
      return method?.trim() || "Non renseigné";
  }
}

function paymentMethodTone(method: string): DashboardTone {
  switch (method.toUpperCase()) {
    case "CASH":
      return "green";
    case "CARD":
      return "blue";
    case "CHECK":
      return "amber";
    default:
      return "slate";
  }
}

function buildCashTrend(payments: DashboardPayment[], trendStart: Date, today: Date): CashTrendDay[] {
  const totalsByDay = new Map<string, number>();

  for (const payment of payments) {
    const key = dateKey(payment.paymentDate);
    totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + payment.amount);
  }

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(trendStart);
    date.setUTCDate(date.getUTCDate() + index);
    const key = dateKey(date);

    return {
      key,
      label: formatTrendLabel(date),
      amount: totalsByDay.get(key) ?? 0,
      isToday: key === dateKey(today),
    };
  });
}

export default async function Home() {
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
  let emailConfigured = false;

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
    const clubSettings = await getClubSettings();

    const [
      fetchedActiveMembers,
      fetchedNewMembersThisMonth,
      fetchedSessionsToday,
      fetchedPaymentWindow,
      fetchedSubscriptions,
      fetchedSessions,
      fetchedRecentMembers,
    ] = await Promise.all([
      prisma.member.count({ where: { status: "ACTIVE" } }),
      prisma.member.count({ where: { status: "ACTIVE", joinedAt: { gte: monthStart, lt: tomorrow } } }),
      prisma.session.count({
        where: {
          sessionDate: { gte: today, lt: tomorrow },
          status: { not: "CANCELLED" },
        },
      }),
      prisma.payment.findMany({
        where: { paymentDate: { gte: paymentWindowStart, lt: tomorrow } },
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
      prisma.member.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ joinedAt: "desc" }, { createdAt: "desc" }],
        take: 3,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          joinedAt: true,
          status: true,
          subscriptions: {
            where: { status: "ACTIVE" },
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
          className="relative overflow-hidden rounded-lg bg-[#0B1220] px-4 py-5 text-white shadow-[0_18px_48px_rgba(37,99,235,0.20)] sm:px-6 lg:min-h-[12.25rem] lg:px-7 lg:py-7"
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
              <h1 className="mt-2 text-3xl font-bold leading-tight tracking-normal sm:text-4xl">
                Aujourd&apos;hui au club
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-blue-50 sm:text-base">
                Les séances à pointer, les encaissements à suivre et les priorités qui demandent une action.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[32rem]">
              <div className="rounded-lg border border-white/18 bg-[#061A3D]/70 px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur">
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-blue-200">
                  Date
                </p>
                <p className="mt-2 text-sm font-bold capitalize text-white">{formatLongDateFr(today)}</p>
              </div>
              <div className="rounded-lg border border-white/18 bg-[#061A3D]/70 px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur">
                <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-blue-200">
                  Séances
                </p>
                <p className="mt-2 text-sm font-bold text-white">{sessionsToday} aujourd&apos;hui</p>
              </div>
              <div className="rounded-lg border border-white/18 bg-[#061A3D]/70 px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur">
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

        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(24rem,0.85fr)]">
          <CashTrendPanel trend={cashTrend} weekTotal={revenueWeek} />
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
        </section>

        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(24rem,0.85fr)]">
          <TodayWorkPanel todaySessions={todaySessions} priorityItems={priorityItems} />
          <MembersOverviewPanel
            activeMembers={activeMembers}
            newMembersThisMonth={newMembersThisMonth}
            expiringSoon={finance.expiringIn7Days}
            pendingPayment={finance.debtorsCount}
            recentMembers={recentMembers}
          />
        </section>

        {debts.length > 0 ? (
          <DashboardPanel labelledBy="dashboard-debts-title" className="min-w-0">
            <DashboardSectionHeader
              titleId="dashboard-debts-title"
              title="Impayés détaillés"
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
        ) : null}
      </div>
    </main>
  );
}
