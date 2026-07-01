import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ReceiptText,
  RotateCcw,
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

type PaymentEntryTypeValue = "PAYMENT" | "CORRECTION" | "REVERSAL";

type DashboardPayment = {
  id: string;
  amount: number;
  entryType: PaymentEntryTypeValue;
  paymentMethod: string | null;
  paymentDate: Date;
  memberName: string;
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
        "group flex min-h-[4.75rem] items-center gap-3 rounded-lg border bg-white p-3 text-[#111827] shadow-[0_6px_18px_rgba(15,23,42,0.045)] transition hover:-translate-y-0.5 hover:border-[#2563EB] hover:shadow-[0_10px_24px_rgba(37,99,235,0.12)] dark:bg-slate-950 dark:text-slate-100",
        tone.border,
      )}
      aria-label={metric.label}
    >
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", tone.icon)}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium leading-tight text-[#64748B] dark:text-slate-400">
          {metric.label}
        </span>
        <span className="mt-1 block truncate text-lg font-bold leading-tight text-[#0B1220] dark:text-slate-50">
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

function PrioritySummary({ items }: { items: PriorityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="mx-4 mb-4 flex items-start gap-3 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-3">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#10B981]" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#047857]">Rien à traiter</p>
          <p className="mt-0.5 text-xs leading-snug text-[#64748B]">
            Aucun impayé urgent, aucune séance à finaliser et aucune échéance critique.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-[#E2E8F0] px-4 py-3 dark:border-slate-800">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">Priorités</p>
          <p className="text-sm font-semibold text-[#0B1220] dark:text-slate-50">À traiter</p>
        </div>
        <Link href="/subscriptions" className="text-xs font-semibold text-[#2563EB] hover:underline">
          Voir tout
        </Link>
      </div>
      <ul className="grid gap-2">
        {items.slice(0, 3).map((item) => {
          const tone = dashboardToneStyles[item.tone];
          const Icon = item.icon;
          return (
            <li key={item.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-2.5">
                  <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", tone.soft, tone.text)}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-[#0B1220] dark:text-slate-50">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-[#64748B] dark:text-slate-400">
                      {item.detail}
                    </span>
                  </span>
                </div>
                <Link
                  href={item.href}
                  className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-lg border border-[#D8E2F0] bg-white px-3 text-xs font-semibold text-[#0B1220] transition hover:border-[#2563EB] hover:text-[#2563EB] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {item.actionLabel}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TodayWorkPanel({
  todaySessions,
  priorityItems,
}: {
  todaySessions: TodaySession[];
  priorityItems: PriorityItem[];
}) {
  return (
    <DashboardPanel labelledBy="dashboard-today-title" className="min-w-0">
      <DashboardSectionHeader
        titleId="dashboard-today-title"
        title="Séances du jour"
        eyebrow="Aujourd'hui"
        action={
          <Link href="/attendance/today" className="text-xs font-semibold text-[#2563EB] hover:underline">
            Ouvrir
          </Link>
        }
      />
      {todaySessions.length === 0 ? (
        <div className="flex min-h-36 flex-col items-center justify-center px-4 py-6 text-center">
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
      <PrioritySummary items={priorityItems} />
    </DashboardPanel>
  );
}

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
          className="group flex items-center gap-3 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] p-3 text-[#0B1220] transition hover:border-[#10B981] hover:bg-[#D1FAE5]"
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
            <span className="font-semibold uppercase tracking-[0.12em] text-[#64748B]">Par moyen</span>
            <span className="text-[#64748B]">Aucun mouvement aujourd&apos;hui</span>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-[#E2E8F0] p-3">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#64748B]">Par moyen</p>
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

        <div className="flex h-48 items-end gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 pb-3 pt-4">
          {trend.map((day) => {
            const height = day.amount === 0 ? 4 : Math.max(12, Math.round((Math.abs(day.amount) / maxAmount) * 140));
            const tone = day.amount < 0 ? dashboardToneStyles.red : day.isToday ? dashboardToneStyles.green : dashboardToneStyles.blue;

            return (
              <div key={day.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                <div className="flex h-36 w-full items-end justify-center">
                  <div
                    className={cn("w-full max-w-9 rounded-t-md", tone.icon)}
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
    </DashboardPanel>
  );
}

function RecentCashMovementsPanel({ movements }: { movements: DashboardPayment[] }) {
  return (
    <DashboardPanel labelledBy="dashboard-cash-movements-title" className="min-w-0">
      <DashboardSectionHeader
        titleId="dashboard-cash-movements-title"
        title="Derniers mouvements"
        eyebrow="Caisse"
        action={
          <Link href="/payments" className="text-xs font-semibold text-[#2563EB] hover:underline">
            Voir tout
          </Link>
        }
      />
      {movements.length === 0 ? (
        <div className="flex min-h-44 flex-col items-center justify-center px-4 py-6 text-center">
          <ReceiptText className="size-8 text-[#94A3B8]" />
          <p className="mt-2 text-sm font-semibold text-[#0B1220]">Aucun mouvement</p>
          <p className="mt-1 max-w-sm text-xs text-[#64748B]">Les derniers paiements apparaîtront ici.</p>
        </div>
      ) : (
        <ul>
          {movements.map((movement) => {
            const tone = dashboardToneStyles[paymentMovementTone(movement)];
            return (
              <li key={movement.id} className="border-t border-[#E2E8F0] px-4 py-3 first:border-t-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#0B1220]">{movement.memberName}</p>
                    <p className="mt-0.5 text-xs text-[#64748B]">
                      {formatPaymentMethodLabel(movement.paymentMethod)} · {formatDateFr(movement.paymentDate)}
                    </p>
                    {movement.entryType !== "PAYMENT" ? (
                      <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[0.66rem] font-semibold", tone.badge)}>
                        {paymentEntryLabel(movement.entryType)}
                      </span>
                    ) : null}
                  </div>
                  <p className={cn("shrink-0 text-sm font-bold", tone.text)}>{formatMoney(movement.amount)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
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

function paymentEntryLabel(entryType: PaymentEntryTypeValue) {
  if (entryType === "CORRECTION") return "Correction";
  if (entryType === "REVERSAL") return "Annulation";
  return "Paiement";
}

function paymentMovementTone(payment: Pick<DashboardPayment, "amount" | "entryType">): DashboardTone {
  if (payment.entryType === "REVERSAL" || payment.amount < 0) return "red";
  if (payment.entryType === "CORRECTION") return "amber";
  return "green";
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
  let attendanceToday = 0;
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
  let recentCashMovements: DashboardPayment[] = [];
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
      fetchedAttendanceToday,
      fetchedSessionsToday,
      fetchedPaymentWindow,
      fetchedRecentPayments,
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
      prisma.payment.findMany({
        where: { paymentDate: { gte: paymentWindowStart, lt: tomorrow } },
        select: {
          id: true,
          amount: true,
          entryType: true,
          paymentMethod: true,
          paymentDate: true,
          memberSubscription: {
            select: {
              member: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: [{ paymentDate: "asc" }, { createdAt: "asc" }],
      }),
      prisma.payment.findMany({
        select: {
          id: true,
          amount: true,
          entryType: true,
          paymentMethod: true,
          paymentDate: true,
          memberSubscription: {
            select: {
              member: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
        take: 5,
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

    const paymentWindow: DashboardPayment[] = fetchedPaymentWindow.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      entryType: payment.entryType as PaymentEntryTypeValue,
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate,
      memberName: `${payment.memberSubscription.member.firstName} ${payment.memberSubscription.member.lastName}`,
    }));
    recentCashMovements = fetchedRecentPayments.map((payment) => ({
      id: payment.id,
      amount: payment.amount,
      entryType: payment.entryType as PaymentEntryTypeValue,
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate,
      memberName: `${payment.memberSubscription.member.firstName} ${payment.memberSubscription.member.lastName}`,
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

        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.8fr)]">
          <TodayWorkPanel todaySessions={todaySessions} priorityItems={priorityItems} />
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

        <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.8fr)]">
          <CashTrendPanel trend={cashTrend} weekTotal={revenueWeek} />
          <RecentCashMovementsPanel movements={recentCashMovements} />
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
              label: "Recouvrement",
              value: finance.collectionRatePercent === null ? "—" : `${finance.collectionRatePercent} %`,
              hint:
                finance.totalOutstandingCents > 0
                  ? `${formatMoney(finance.totalOutstandingCents)} à encaisser`
                  : `${finance.activeSubscriptionsCount} abonnement${finance.activeSubscriptionsCount > 1 ? "s" : ""} actif${finance.activeSubscriptionsCount > 1 ? "s" : ""}`,
              href: "/subscriptions",
              icon: ClipboardCheck,
              tone: finance.totalOutstandingCents > 0 ? "amber" : "green",
            }}
          />
          <DashboardMetricCard
            metric={{
              label: "Impayés détaillés",
              value: debts.length > 0 ? debts.length : "Aucun",
              hint: debts.length > 0 ? "Dossiers à relancer" : "Masqué si rien à suivre",
              href: "/subscriptions",
              icon: ReceiptText,
              tone: debts.length > 0 ? "red" : "green",
            }}
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
