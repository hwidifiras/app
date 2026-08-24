import Link from "next/link";
import { AlertTriangle, Clock3, Eye, X } from "lucide-react";

import { formatDateFr, isTodaySession } from "@/components/sessions/session-planner-derived-model";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatRoomLabel } from "@/lib/group-room";
import { cn } from "@/lib/utils";
import type { SessionDto, SessionStatusDto } from "@/types/session";

const sessionStatusLabels: Record<SessionStatusDto, string> = {
  PLANNED: "Planifiée",
  RESCHEDULED: "Reportée",
  CANCELLED: "Annulée",
  COMPLETED: "Terminée",
};

export function displayedSessionStatus(session: SessionDto) {
  if (session.operationalStatus === "NEEDS_FINALIZATION") {
    return {
      label: session.unmarkedCount ? `Pointage incomplet (${session.unmarkedCount})` : "À finaliser",
      variant: "warning" as const,
    };
  }
  return {
    label: sessionStatusLabels[session.status],
    variant:
      session.status === "CANCELLED"
        ? ("danger" as const)
        : session.status === "COMPLETED"
          ? ("success" as const)
          : session.status === "RESCHEDULED"
            ? ("warning" as const)
            : ("info" as const),
  };
}

function canCancelSession(session: SessionDto) {
  return (session.attendanceCount ?? 0) === 0 && session.status !== "CANCELLED";
}

function primaryActionLabel(session: SessionDto) {
  if (session.operationalStatus === "NEEDS_FINALIZATION") return "Finaliser";
  if (session.status === "COMPLETED" || session.status === "CANCELLED" || !isTodaySession(session)) return "Consulter";
  return "Pointer";
}

function attendanceHref(session: SessionDto) {
  return `/attendance/today?sessionId=${session.id}`;
}

function sessionRailClass(session: SessionDto, hasConflict: boolean) {
  if (hasConflict) return "bg-[var(--danger)]";
  if (session.operationalStatus === "NEEDS_FINALIZATION") return "bg-[var(--warning)]";
  if (session.status === "COMPLETED") return "bg-[var(--success)]";
  if (session.status === "CANCELLED") return "bg-[var(--muted-foreground)]";
  return "bg-[var(--primary)]";
}

export function PlanningLegend() {
  const items = [
    { label: "Planifiée", className: "bg-[var(--primary)]" },
    { label: "À finaliser", className: "bg-[var(--warning)]" },
    { label: "Terminée", className: "bg-[var(--success)]" },
    { label: "Conflit", className: "bg-[var(--danger)]" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] font-medium text-[var(--muted-foreground)]">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", item.className)} aria-hidden="true" />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function SessionTile({
  item,
  onSelect,
  selected,
  hasConflict = false,
}: {
  item: SessionDto;
  onSelect: (session: SessionDto) => void;
  selected: boolean;
  hasConflict?: boolean;
}) {
  const displayedStatus = displayedSessionStatus(item);
  const checkedCount = item.checkedMemberCount ?? item.attendanceCount ?? 0;
  const expectedCount = item.expectedMemberCount ?? 0;

  return (
    <li
      className={cn(
        "relative min-w-0 overflow-hidden rounded-lg border bg-[var(--surface)] shadow-sm transition",
        selected
          ? "border-[var(--primary)]/55 bg-[var(--primary)]/[0.035] ring-2 ring-[var(--primary)]/15"
          : hasConflict
            ? "border-[var(--danger)]/45"
            : "border-[var(--border)] hover:border-[var(--primary)]/30 hover:shadow-[var(--shadow-panel)]",
      )}
    >
      <div className={cn("absolute inset-y-0 left-0 w-1", sessionRailClass(item, hasConflict))} aria-hidden="true" />
      <button
        id={`planning-session-${item.id}`}
        type="button"
        onClick={() => onSelect(item)}
        aria-pressed={selected}
        className="min-h-[7rem] w-full min-w-0 px-3 py-2.5 pl-3.5 text-left"
      >
        <div className="flex flex-wrap items-start justify-between gap-1.5">
          <p className="inline-flex items-center gap-1 text-xs font-black tabular-nums text-[var(--foreground)]">
            <Clock3 className="size-3.5 text-[var(--muted-foreground)]" aria-hidden="true" />
            {item.startTime} – {item.endTime}
          </p>
          <StatusBadge variant={hasConflict ? "danger" : displayedStatus.variant} className="max-w-[7.5rem] truncate">
            {hasConflict ? "Conflit" : displayedStatus.label}
          </StatusBadge>
        </div>
        <p className="mt-2 truncate text-sm font-bold text-[var(--foreground)]">{item.groupName}</p>
        <p className="mt-1 truncate text-[0.72rem] text-[var(--muted-foreground)]">
          {item.coachName ?? "Sans coach"} · {formatRoomLabel(item.room)}
        </p>
        <div className="mt-2 flex items-center justify-between gap-2 text-[0.68rem]">
          <span className="font-semibold text-[var(--muted-foreground)]">{checkedCount}/{expectedCount} pointés</span>
          {(item.unmarkedCount ?? 0) > 0 && item.operationalStatus === "NEEDS_FINALIZATION" ? (
            <span className="font-bold text-[var(--warning)]">
              {item.unmarkedCount} restant{(item.unmarkedCount ?? 0) > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
      </button>
    </li>
  );
}

export function SessionDetailPanel({
  session,
  conflictReasons,
  onEdit,
  onCancel,
  onClose,
  titleId,
  className,
  canManage,
  readOnly = false,
}: {
  session: SessionDto | null;
  conflictReasons: string[];
  onEdit: (session: SessionDto) => void;
  onCancel: (session: SessionDto) => void;
  onClose?: () => void;
  titleId?: string;
  className?: string;
  canManage: boolean;
  readOnly?: boolean;
}) {
  if (!session) return null;

  const displayedStatus = displayedSessionStatus(session);
  const checkedCount = session.checkedMemberCount ?? session.attendanceCount ?? 0;
  const expectedCount = session.expectedMemberCount ?? 0;
  const progress = expectedCount > 0 ? Math.min(100, Math.round((checkedCount / expectedCount) * 100)) : 0;
  const actionLabel = readOnly ? "Consulter le pointage" : primaryActionLabel(session);
  const canCancel = canCancelSession(session);
  const actionIsAttendanceLink =
    session.operationalStatus === "NEEDS_FINALIZATION" ||
    session.status === "COMPLETED" ||
    (isTodaySession(session) && session.status !== "CANCELLED");

  return (
    <aside className={cn("rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)]", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">Séance sélectionnée</p>
          <h2 id={titleId} className="mt-1 truncate text-lg font-bold text-[var(--foreground)]">{session.groupName}</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {formatDateFr(session.sessionDate)} · {session.startTime} – {session.endTime}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-1.5">
          <StatusBadge variant={conflictReasons.length ? "danger" : displayedStatus.variant}>
            {conflictReasons.length ? "Conflit" : displayedStatus.label}
          </StatusBadge>
          {onClose ? (
            <button type="button" onClick={onClose} className="btn btn-ghost min-h-11 min-w-11 p-2" aria-label="Fermer les détails">
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

      {readOnly ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-950">
          <Eye className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p><strong>Démo en lecture seule.</strong> Vous pouvez parcourir le pointage sans modifier les données.</p>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Coach</p>
          <p className="mt-1 truncate font-semibold text-[var(--foreground)]">{session.coachName ?? "Sans coach"}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">Salle</p>
          <p className="mt-1 truncate font-semibold text-[var(--foreground)]">{formatRoomLabel(session.room)}</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--muted-foreground)]">
          <span>Pointage</span>
          <span>{checkedCount}/{expectedCount} pointés</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface)]">
          <div
            className={cn("h-full rounded-full", conflictReasons.length ? "bg-[var(--danger)]" : "bg-[var(--primary)]")}
            style={{ width: `${progress}%` }}
          />
        </div>
        {(session.unmarkedCount ?? 0) > 0 ? (
          <p className="mt-2 text-xs font-medium text-[var(--warning)]">
            {session.unmarkedCount} élève{session.unmarkedCount && session.unmarkedCount > 1 ? "s" : ""} restant{session.unmarkedCount && session.unmarkedCount > 1 ? "s" : ""}
          </p>
        ) : null}
      </div>

      {conflictReasons.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/10 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--danger)]">À corriger</p>
          <ul className="mt-2 space-y-1 text-xs text-[var(--foreground)]">
            {conflictReasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            Solution : changer l&apos;horaire, le coach, la salle ou ajuster les préférences du club.
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {actionIsAttendanceLink ? (
          <Link
            href={attendanceHref(session)}
            prefetch={false}
            className={cn(
              "btn btn-sm w-full",
              !readOnly && (actionLabel === "Finaliser" || actionLabel === "Pointer") ? "btn-primary" : "btn-ghost",
            )}
          >
            {!readOnly && actionLabel === "Finaliser" ? <AlertTriangle className="size-4" /> : null}
            {actionLabel}
          </Link>
        ) : null}
        {canManage ? (
          <>
            <button type="button" onClick={() => onEdit(session)} className="btn btn-ghost btn-sm w-full">
              Modifier la séance
            </button>
            <button
              type="button"
              onClick={() => onCancel(session)}
              disabled={!canCancel}
              className="btn btn-ghost btn-sm w-full border-[var(--danger)]/30 text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Annuler la séance
            </button>
          </>
        ) : null}
      </div>
    </aside>
  );
}
