import type { ReactNode } from "react";

import { formatDateFr } from "@/components/sessions/session-planner-derived-model";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import type { ClubDay } from "@/lib/club-working-days";
import type { SessionDto } from "@/types/session";

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
  const minimumBoardWidthRem = Math.max(days.length, 1) * 9.75 + Math.max(days.length - 1, 0) * 0.5;

  return (
    <>
      <div
        className="hidden max-w-full overflow-x-auto overscroll-x-contain pb-2 lg:block"
        role="region"
        aria-label="Planning hebdomadaire, défilement horizontal"
        tabIndex={0}
      >
        <div
          className="grid w-full items-start gap-2"
          style={{
            gridTemplateColumns: `repeat(${Math.max(days.length, 1)}, minmax(9.75rem, 1fr))`,
            minWidth: `${minimumBoardWidthRem}rem`,
          }}
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
                        {dayStats?.expected ?? 0} élèves
                      </span>
                      {(dayStats?.finalization ?? 0) > 0 ? (
                        <span className="rounded-full bg-[var(--warning)]/10 px-2 py-0.5 text-[0.62rem] font-semibold text-[var(--warning)]">
                          {dayStats?.finalization} à finaliser
                        </span>
                      ) : null}
                      {(dayStats?.conflicts ?? 0) > 0 ? (
                        <span className="rounded-full bg-[var(--danger)]/10 px-2 py-0.5 text-[0.62rem] font-semibold text-[var(--danger)]">
                          {dayStats?.conflicts} conflit{(dayStats?.conflicts ?? 0) > 1 ? "s" : ""}
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
      </div>

      <div className="min-w-0 space-y-3 overflow-hidden lg:hidden">
        <div
          className="-mx-1 flex max-w-full min-w-0 gap-2 overflow-x-auto px-1 pb-1"
          role="group"
          aria-label="Jours de la semaine"
        >
          {days.map((day) => {
            const dayStats = dayStatsByDate.get(day.key);
            const active = activeMobileDay === day.key;
            return (
              <button
                key={day.key}
                id={`planning-day-tab-${day.key}`}
                type="button"
                aria-pressed={active}
                aria-controls={`planning-day-panel-${day.key}`}
                onClick={() => onSelectMobileDay(day.key)}
                className={cn(
                  "min-h-14 min-w-[5.25rem] rounded-lg border px-2 py-2 text-center transition",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-sm"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]",
                )}
              >
                <span className="block truncate text-[0.7rem] font-bold capitalize">{day.label} {day.dateLabel}</span>
                <span className={cn("mt-0.5 block text-[0.68rem]", active ? "text-white/80" : "text-[var(--muted-foreground)]")}>
                  {dayStats?.total ?? 0} cours
                  {(dayStats?.finalization ?? 0) > 0 || (dayStats?.conflicts ?? 0) > 0 ? " · à traiter" : ""}
                </span>
              </button>
            );
          })}
        </div>

        {days.filter((day) => day.key === activeMobileDay).map((day) => {
          const daySessions = sessionsByDate.get(day.key) ?? [];
          const dayStats = dayStatsByDate.get(day.key);
          return (
            <section
              key={day.key}
              id={`planning-day-panel-${day.key}`}
              aria-labelledby={`planning-day-tab-${day.key}`}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-3.5 shadow-[var(--shadow-panel)] sm:p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold capitalize text-[var(--foreground)]">{formatDateFr(`${day.key}T00:00:00`)}</h3>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    {dayStats?.expected ?? 0} élèves attendus · {dayStats?.finalization ?? 0} à finaliser
                  </p>
                </div>
                {(dayStats?.conflicts ?? 0) > 0 ? (
                  <StatusBadge variant="danger">{dayStats?.conflicts} conflit{(dayStats?.conflicts ?? 0) > 1 ? "s" : ""}</StatusBadge>
                ) : null}
              </div>

              {daySessions.length > 0 ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
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
