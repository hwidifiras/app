import { ChevronDown } from "lucide-react";

import {
  dayLabels,
  formatPeriod,
  getScheduleStatus,
  statusClass,
  statusLabel,
  type DayOfWeekValue,
  type ScheduleRow,
  type ScheduleStatus,
} from "@/components/groups/group-schedule-model";

export type SchedulePeriod = {
  key: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  rows: ScheduleRow[];
  status: ScheduleStatus;
};

type GroupSchedulePeriodsProps = {
  periods: SchedulePeriod[];
  scheduleCount: number;
  expandedScheduleIds: string[];
  closingId: string | null;
  deletingId: string | null;
  onPrefillFromCurrent: () => void;
  onToggleExpand: (scheduleId: string) => void;
  onEdit: (schedule: ScheduleRow) => void;
  onQueueClose: (schedule: ScheduleRow) => void;
  onQueueDelete: (schedule: ScheduleRow) => void;
};

export function GroupSchedulePeriods({
  periods,
  scheduleCount,
  expandedScheduleIds,
  closingId,
  deletingId,
  onPrefillFromCurrent,
  onToggleExpand,
  onEdit,
  onQueueClose,
  onQueueDelete,
}: GroupSchedulePeriodsProps) {
  return (
    <div id="schedule-current" className="form-section-anchor rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)] sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Périodes d&apos;horaires</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {periods.length} période(s) · {scheduleCount} horaire(s)
          </p>
        </div>
        {scheduleCount > 0 ? (
          <button type="button" onClick={onPrefillFromCurrent} className="btn btn-ghost text-sm">
            Reprendre les horaires actuels
          </button>
        ) : null}
      </div>

      {periods.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-6 text-center text-sm text-[var(--muted-foreground)]">
          Aucun horaire défini. Ajoutez une période avec les jours d&apos;entraînement du groupe.
        </div>
      ) : (
        <div className="space-y-3">
          {periods.map((period) => (
            <section key={period.key} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                    Période d&apos;application
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-[var(--foreground)]">
                    {formatPeriod(period.effectiveFrom, period.effectiveTo)}
                  </h3>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(period.status)}`}>
                  {statusLabel(period.status)}
                </span>
              </div>

              <div className="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
                {period.rows.map((row) => {
                  const status = getScheduleStatus(row);
                  const expanded = expandedScheduleIds.includes(row.id);
                  return (
                    <article key={row.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">
                            {dayLabels[row.dayOfWeek as DayOfWeekValue] ?? row.dayOfWeek}
                          </p>
                          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                            {row.startTime} · {row.durationMinutes} min
                          </p>
                        </div>
                        <button
                          type="button"
                          className="mobile-card-toggle md:hidden"
                          onClick={() => onToggleExpand(row.id)}
                          aria-expanded={expanded}
                        >
                          {expanded ? "Réduire" : "Infos"}
                          <ChevronDown className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => onEdit(row)} className="btn btn-ghost min-h-0 px-2 py-1 text-xs">
                          Modifier
                        </button>
                        {status === "ACTIVE" ? (
                          <button
                            type="button"
                            onClick={() => onQueueClose(row)}
                            disabled={closingId !== null}
                            className="btn btn-ghost min-h-0 px-2 py-1 text-xs"
                          >
                            Arrêter aujourd&apos;hui
                          </button>
                        ) : null}
                        {status === "FUTURE" ? (
                          <button
                            type="button"
                            onClick={() => onQueueDelete(row)}
                            disabled={deletingId !== null}
                            className="btn btn-danger min-h-0 px-2 py-1 text-xs"
                          >
                            Retirer
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
