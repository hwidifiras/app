import { CalendarPlus, ChevronLeft, ChevronRight, Eye } from "lucide-react";

import type { PlanningViewMode, PlanningWeekSummary } from "@/components/sessions/session-planner-derived-model";
import { formatDateFr } from "@/components/sessions/session-planner-derived-model";
import { PlanningLegend } from "@/components/sessions/session-planner-ui";
import { cn } from "@/lib/utils";

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
  canManage,
  readOnly = false,
}: {
  weekStart: string;
  weekEnd: string;
  generating: boolean;
  loading: boolean;
  onPreviousWeek: () => void;
  onCurrentWeek: () => void;
  onNextWeek: () => void;
  onPreviewGeneration: () => void;
  canManage: boolean;
  readOnly?: boolean;
}) {
  const weekLabel = `${formatDateFr(`${weekStart}T12:00:00.000Z`)} – ${formatDateFr(`${weekEnd}T12:00:00.000Z`)}`;

  return (
    <div className="grid gap-3 border-b border-[var(--border)] pb-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 sm:max-w-xl">
        <button
          type="button"
          onClick={onPreviousWeek}
          disabled={loading}
          className="btn btn-ghost min-h-11 min-w-11 px-2"
          aria-label="Semaine précédente"
          title="Semaine précédente"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="min-w-0 text-center sm:text-left">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-[var(--primary)]">
            Planning hebdomadaire
          </p>
          <p className="mt-0.5 truncate text-sm font-bold text-[var(--foreground)] sm:text-base">{weekLabel}</p>
        </div>
        <button
          type="button"
          onClick={onNextWeek}
          disabled={loading}
          className="btn btn-ghost min-h-11 min-w-11 px-2"
          aria-label="Semaine suivante"
          title="Semaine suivante"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <button type="button" onClick={onCurrentWeek} disabled={loading} className="btn btn-ghost btn-sm flex-1 sm:flex-none">
          Aujourd&apos;hui
        </button>
        {readOnly ? (
          <span className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-900 sm:flex-none">
            <Eye className="size-4" aria-hidden="true" />
            Démo en lecture seule
          </span>
        ) : null}
        {canManage ? (
          <button
            type="button"
            onClick={onPreviewGeneration}
            disabled={generating || loading}
            className="btn btn-primary btn-sm flex-1 sm:flex-none"
          >
            <CalendarPlus className="size-4" />
            {generating ? "Analyse…" : "Générer les séances"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  tone = "neutral",
  onClick,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "primary" | "warning" | "success" | "danger";
  onClick?: () => void;
}) {
  const className = cn(
    "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-left",
    tone === "neutral" && "border-[var(--border)] bg-[var(--surface-soft)]",
    tone === "primary" && "border-[var(--primary)]/20 bg-[var(--primary)]/10",
    tone === "warning" && "border-[var(--warning)]/25 bg-[var(--warning)]/10",
    tone === "success" && "border-[var(--success)]/25 bg-[var(--success)]/10",
    tone === "danger" && "border-[var(--danger)]/25 bg-[var(--danger)]/10",
    onClick && "transition hover:-translate-y-px hover:shadow-sm",
  );
  const content = (
    <>
      <span className="text-base font-black tabular-nums text-[var(--foreground)]">{value}</span>
      <span className="whitespace-nowrap text-[0.7rem] font-bold uppercase tracking-[0.08em] text-[var(--muted-foreground)]">
        {label}
      </span>
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
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
    <div className="mt-3">
      <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Résumé de la semaine">
        <SummaryChip label="cours" value={summary.total} />
        {summary.needsAttendance > 0 ? (
          <SummaryChip label="à pointer" value={summary.needsAttendance} tone="primary" />
        ) : null}
        {summary.needsFinalization > 0 ? (
          <SummaryChip label="à finaliser" value={summary.needsFinalization} tone="warning" />
        ) : null}
        {summary.completed > 0 ? <SummaryChip label="terminés" value={summary.completed} tone="success" /> : null}
        {summary.conflicts > 0 ? (
          <SummaryChip label="conflits" value={summary.conflicts} tone="danger" onClick={onFocusFirstConflict} />
        ) : null}
        {summary.noCoach > 0 ? <SummaryChip label="sans coach" value={summary.noCoach} tone="warning" /> : null}
        {summary.cancelledOrRescheduled > 0 ? (
          <SummaryChip label="annulés/reportés" value={summary.cancelledOrRescheduled} />
        ) : null}
      </div>
      {summary.conflicts > 0 ? (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/10 px-3 py-2 text-xs">
          <p className="min-w-0 text-[var(--foreground)]">
            <strong className="text-[var(--danger)]">{summary.conflicts} conflit{summary.conflicts > 1 ? "s" : ""}</strong>{" "}
            de coach ou de salle à corriger.
          </p>
          <button type="button" onClick={onFocusFirstConflict} className="shrink-0 font-bold text-[var(--danger)] hover:underline">
            Voir
          </button>
        </div>
      ) : null}
    </div>
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
    <div className="mt-3 flex min-w-0 items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-1.5">
      <div className="flex min-w-0 gap-1 overflow-x-auto" role="group" aria-label="Mode d’affichage du planning">
        {planningViewModes.map((mode) => (
          <button
            key={mode.value}
            type="button"
            aria-pressed={viewMode === mode.value}
            onClick={() => onViewModeChange(mode.value)}
            className={cn(
              "min-h-11 shrink-0 rounded-md px-3 text-xs font-bold transition",
              viewMode === mode.value
                ? "bg-[var(--primary)] text-white shadow-sm"
                : "text-[var(--muted-foreground)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <div className="hidden shrink-0 md:block">
        <PlanningLegend />
      </div>
    </div>
  );
}
