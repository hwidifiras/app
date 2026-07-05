import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";

import { PlanningLegend, formatDateFr } from "@/components/sessions/session-planner-ui";
import { cn } from "@/lib/utils";

export type PlanningViewMode = "week" | "day" | "coach" | "room";

export type PlanningWeekSummary = {
  total: number;
  needsAttendance: number;
  needsFinalization: number;
  completed: number;
  conflicts: number;
  noCoach: number;
  cancelledOrRescheduled: number;
};

const planningViewModes: Array<{ value: PlanningViewMode; label: string }> = [
  { value: "week", label: "Semaine" },
  { value: "day", label: "Jour" },
  { value: "coach", label: "Coach" },
  { value: "room", label: "Salle" },
];

export function PlanningCommandHeader({
  weekStart,
  weekEnd,
  generating,
  loading,
  onPreviousWeek,
  onCurrentWeek,
  onNextWeek,
  onPreviewGeneration,
}: {
  weekStart: string;
  weekEnd: string;
  generating: boolean;
  loading: boolean;
  onPreviousWeek: () => void;
  onCurrentWeek: () => void;
  onNextWeek: () => void;
  onPreviewGeneration: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 xl:flex-row xl:items-start xl:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Planning semaine</p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">Command center des cours</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Semaine du {formatDateFr(`${weekStart}T12:00:00.000Z`)} au {formatDateFr(`${weekEnd}T12:00:00.000Z`)}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-[auto_auto_auto_auto] xl:justify-end">
        <button type="button" onClick={onPreviousWeek} className="btn btn-ghost px-3" aria-label="Semaine précédente">
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Précédente</span>
        </button>
        <button type="button" onClick={onCurrentWeek} className="btn btn-ghost">
          Aujourd&apos;hui
        </button>
        <button type="button" onClick={onNextWeek} className="btn btn-ghost px-3" aria-label="Semaine suivante">
          <span className="hidden sm:inline">Suivante</span>
          <ChevronRight className="size-4" />
        </button>
        <button type="button" onClick={onPreviewGeneration} disabled={generating || loading} className="btn btn-primary">
          <CalendarPlus className="size-4" />
          {generating ? "Analyse..." : "Générer depuis horaires"}
        </button>
      </div>
    </div>
  );
}

export function PlanningSummaryStrip({
  summary,
  onFocusFirstConflict,
}: {
  summary: PlanningWeekSummary;
  onFocusFirstConflict: () => void;
}) {
  return (
    <>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Cours</p>
          <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-[var(--warning)]/25 bg-[var(--warning)]/10 px-3 py-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--warning)]">À traiter</p>
          <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{summary.needsFinalization}</p>
        </div>
        <div className="rounded-lg border border-[var(--success)]/25 bg-[var(--success)]/10 px-3 py-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--success)]">Terminés</p>
          <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{summary.completed}</p>
        </div>
        <div className="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/10 px-3 py-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[var(--danger)]">Conflits</p>
          <p className="mt-1 text-lg font-bold text-[var(--foreground)]">{summary.conflicts}</p>
        </div>
      </div>

      {(summary.noCoach > 0 || summary.cancelledOrRescheduled > 0 || summary.needsAttendance > 0) ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {summary.needsAttendance > 0 ? (
            <span className="rounded-full bg-[var(--primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--primary)]">
              {summary.needsAttendance} à pointer
            </span>
          ) : null}
          {summary.noCoach > 0 ? (
            <span className="rounded-full bg-[var(--warning)]/10 px-3 py-1 text-xs font-semibold text-[var(--warning)]">
              {summary.noCoach} sans coach
            </span>
          ) : null}
          {summary.cancelledOrRescheduled > 0 ? (
            <span className="rounded-full bg-[var(--muted-surface)] px-3 py-1 text-xs font-semibold text-[var(--muted-foreground)]">
              {summary.cancelledOrRescheduled} annulé/reporté
            </span>
          ) : null}
        </div>
      ) : null}

      {summary.conflicts > 0 ? (
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/10 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-bold text-[var(--danger)]">{summary.conflicts} conflit{summary.conflicts > 1 ? "s" : ""} à corriger</p>
            <p className="mt-0.5 text-xs text-[var(--foreground)]">
              Un coach ou une salle est utilisé sur deux cours qui se chevauchent.
            </p>
          </div>
          <button type="button" onClick={onFocusFirstConflict} className="btn btn-ghost btn-sm shrink-0 border-[var(--danger)]/30 text-[var(--danger)]">
            Voir le premier conflit
          </button>
        </div>
      ) : null}
    </>
  );
}

export function PlanningViewSwitcher({
  viewMode,
  onViewModeChange,
}: {
  viewMode: PlanningViewMode;
  onViewModeChange: (mode: PlanningViewMode) => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2 md:flex-row md:items-center md:justify-between">
      <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap">
        {planningViewModes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            onClick={() => onViewModeChange(mode.value)}
            className={cn(
              "rounded-md px-3 py-2 text-xs font-bold transition",
              viewMode === mode.value
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <PlanningLegend />
    </div>
  );
}
