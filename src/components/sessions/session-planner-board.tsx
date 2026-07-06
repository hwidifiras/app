import type { ReactNode } from "react";

import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import type { ClubDay } from "@/lib/club-working-days";
import type { SessionDto } from "@/types/session";
import { formatDateFr } from "@/components/sessions/session-planner-derived-model";

export type PlanningWeekDay = {
  key: string;
  dayIndex: number;
  dayOfWeek: ClubDay;
  label: string;
  dateLabel: string;
};

export type PlanningDayStats = {
  total: number;
  expected: number;
  finalization: number;
  conflicts: number;
};

type PlanningWeekBoardProps = {
  days: PlanningWeekDay[];
  sessionsByDate: ReadonlyMap<string, SessionDto[]>;
  dayStatsByDate: ReadonlyMap<string, PlanningDayStats>;
  activeMobileDay: string;
  onSelectMobileDay: (dayKey: string) => void;
  renderSessionTile: (session: SessionDto) => ReactNode;
};

export function PlanningWeekBoard({
  days,
  sessionsByDate,
  dayStatsByDate,
  activeMobileDay,
  onSelectMobileDay,
  renderSessionTile,
}: PlanningWeekBoardProps) {
  return (
    <>
      <div
        className="hidden items-start gap-2 lg:grid"
        style={{ gridTemplateColumns: `repeat(${Math.max(days.length, 1)}, minmax(0, 1fr))` }}
      >
        {days.map((day) => {
          const daySessions = sessionsByDate.get(day.key) ?? [];
          const dayStats = dayStatsByDate.get(day.key);

          return (
            <section key={day.key} className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-2 shadow-[var(--shadow-panel)]">
              <div className="rounded-md bg-[var(--surface-soft)] px-2 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold capitalize text-[var(--foreground)]">{day.label}</p>
                    <p className="text-[0.7rem] text-[var(--muted-foreground)]">{day.dateLabel}</p>
                  </div>
                  <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[0.65rem] font-semibold text-[var(--muted-foreground)]">
                    {dayStats?.total ?? 0}
                  </span>
                </div>
                {daySessions.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[0.62rem] font-semibold text-[var(--primary)]">
                      {dayStats?.expected ?? 0} eleves
                    </span>
                    {(dayStats?.finalization ?? 0) > 0 ? (
                      <span className="rounded-full bg-[var(--warning)]/10 px-2 py-0.5 text-[0.62rem] font-semibold text-[var(--warning)]">
                        {dayStats?.finalization} a finaliser
                      </span>
                    ) : null}
                    {(dayStats?.conflicts ?? 0) > 0 ? (
                      <span className="rounded-full bg-[var(--danger)]/10 px-2 py-0.5 text-[0.62rem] font-semibold text-[var(--danger)]">
                        {dayStats?.conflicts} conflit
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {daySessions.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {daySessions.map(renderSessionTile)}
                </ul>
              ) : (
                <div className="mt-2 rounded-lg border border-dashed border-[var(--border)] px-2 py-4 text-center text-xs text-[var(--muted-foreground)]">
                  Aucun cours
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="min-w-0 space-y-3 overflow-hidden lg:hidden">
        <div className="-mx-1 flex max-w-full min-w-0 gap-2 overflow-x-auto px-1 pb-1">
          {days.map((day) => {
            const dayStats = dayStatsByDate.get(day.key);
            const active = activeMobileDay === day.key;
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => onSelectMobileDay(day.key)}
                className={cn(
                  "min-w-[4.75rem] rounded-lg border px-2 py-2 text-center transition",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]",
                )}
              >
                <span className="block truncate text-[0.68rem] font-bold capitalize">{day.label}</span>
                <span className={cn("block text-[0.68rem]", active ? "text-white/80" : "text-[var(--muted-foreground)]")}>
                  {dayStats?.total ?? 0} cours
                </span>
              </button>
            );
          })}
        </div>

        {days.filter((day) => day.key === activeMobileDay).map((day) => {
          const daySessions = sessionsByDate.get(day.key) ?? [];
          const dayStats = dayStatsByDate.get(day.key);
          return (
            <section key={day.key} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3.5 shadow-[var(--shadow-panel)] sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold capitalize text-[var(--foreground)]">{formatDateFr(`${day.key}T00:00:00`)}</h3>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    {dayStats?.expected ?? 0} eleves attendus · {dayStats?.finalization ?? 0} a finaliser
                  </p>
                </div>
                {(dayStats?.conflicts ?? 0) > 0 ? (
                  <StatusBadge variant="danger">{dayStats?.conflicts} conflit</StatusBadge>
                ) : null}
              </div>

              {daySessions.length > 0 ? (
                <ul className="mt-3 grid gap-2">
                  {daySessions.map(renderSessionTile)}
                </ul>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed border-[var(--border)] px-3 py-5 text-center text-xs text-[var(--muted-foreground)]">
                  Aucun cours
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
