import Link from "next/link";
import { ArrowRight, BarChart3, RotateCcw, Wallet } from "lucide-react";

import {
  DashboardPanel,
  DashboardSectionHeader,
  dashboardToneStyles,
} from "@/components/dashboard/dashboard-ui";
import type { CashMethodStat, CashTrendDay } from "@/components/dashboard/dashboard-model";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/subscription-billing";
import { paymentNewHref } from "@/lib/payment-navigation";

export function CashRegisterPanel({
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
          <Link href={paymentNewHref({ returnTo: "/" })} className="inline-flex min-h-11 items-center text-xs font-semibold text-[#2563EB] hover:underline">
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
                      <span className={cn("shrink-0 font-semibold", tone.text)}>{formatMoney(stat.amount)}</span>
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

export function CashTrendPanel({ trend, weekTotal }: { trend: CashTrendDay[]; weekTotal: number }) {
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
