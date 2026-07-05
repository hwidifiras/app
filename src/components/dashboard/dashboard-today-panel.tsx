import Link from "next/link";
import { CalendarCheck2, CheckCircle2 } from "lucide-react";

import {
  DashboardPanel,
  DashboardSectionHeader,
  dashboardToneStyles,
  type DashboardTone,
  type IconComponent,
} from "@/components/dashboard/dashboard-ui";
import { formatRoomLabel } from "@/lib/group-room";
import type { SessionOperationalStatus } from "@/lib/session-lifecycle";
import { cn } from "@/lib/utils";

export type TodaySession = {
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

export type PriorityItem = {
  id: string;
  title: string;
  detail: string;
  meta?: string;
  href: string;
  actionLabel: string;
  icon: IconComponent;
  tone: DashboardTone;
};

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
          prefetch={false}
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
      <div className="mx-4 mb-4 flex items-start gap-3 rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-3">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#2563EB]" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0B3B8F]">Rien à traiter</p>
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
                  prefetch={false}
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

export function TodayWorkPanel({
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
          <CalendarCheck2 className="size-10 text-[#2563EB]" />
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
