import Link from "next/link";
import { AlertTriangle, ChevronDown, Clock3, MoreHorizontal } from "lucide-react";

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
  onEdit,
  onCancel,
  onToggle,
  expanded,
  conflictReasons,
  hasConflict = false,
}: {
  item: SessionDto;
  onEdit: (session: SessionDto) => void;
  onCancel: (session: SessionDto) => void;
  onToggle: (session: SessionDto) => void;
  expanded: boolean;
  conflictReasons: string[];
  hasConflict?: boolean;
}) {
  const displayedStatus = displayedSessionStatus(item);
  const canCancel = canCancelSession(item);
  const actionLabel = primaryActionLabel(item);
  const checkedCount = item.checkedMemberCount ?? item.attendanceCount ?? 0;
  const expectedCount = item.expectedMemberCount ?? 0;
  const progress = expectedCount > 0 ? Math.min(100, Math.round((checkedCount / expectedCount) * 100)) : 0;
  const actionIsAttendanceLink =
    item.operationalStatus === "NEEDS_FINALIZATION" ||
    item.status === "COMPLETED" ||
    (isTodaySession(item) && item.status !== "CANCELLED");

  return (
    <li
      className={`relative overflow-visible rounded-lg border bg-[var(--surface)] shadow-sm transition hover:shadow-[var(--shadow-panel)] ${
        expanded
          ? "border-[var(--primary)]/45 ring-1 ring-[var(--primary)]/15"
          : hasConflict
            ? "border-[var(--danger)]/45 ring-1 ring-[var(--danger)]/10"
            : "border-[var(--border)]"
      }`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${sessionRailClass(item, hasConflict)}`} aria-hidden="true" />
      <div className="flex h-full min-w-0 flex-col pl-1">
        <button type="button" onClick={() => onToggle(item)} className="min-w-0 px-2.5 py-2.5 text-left">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="inline-flex items-center gap-1 rounded-md bg-[var(--surface-soft)] px-1.5 py-1 text-[0.7rem] font-bold text-[var(--foreground)]">
              <Clock3 className="size-3" />
              {item.startTime} - {item.endTime}
            </p>
            <span className="flex shrink-0 items-center gap-1">
              <StatusBadge variant={hasConflict && expanded ? "danger" : displayedStatus.variant} className="max-w-24 truncate">
                {hasConflict && expanded ? "Conflit" : displayedStatus.label}
              </StatusBadge>
              <ChevronDown
                className={`size-3.5 text-[var(--muted-foreground)] transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </span>
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-[var(--foreground)]">{item.groupName}</p>
          <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">
            {item.coachName ?? "Sans coach"} · {formatRoomLabel(item.room)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[0.68rem] text-[var(--muted-foreground)]">
            <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5">
              {checkedCount}/{expectedCount} pointés
            </span>
            {expanded && item.unmarkedCount ? (
              <span className="rounded-full bg-[var(--warning)]/10 px-2 py-0.5 text-[var(--warning)]">
                {item.unmarkedCount} restant{item.unmarkedCount > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>
          {hasConflict && expanded && conflictReasons[0] ? (
            <p className="mt-1 truncate text-[0.68rem] font-medium text-[var(--danger)]">{conflictReasons[0]}</p>
          ) : expanded && item.exceptionReason ? (
            <p className="mt-1 text-xs text-[var(--danger)]">Motif: {item.exceptionReason}</p>
          ) : null}
        </button>

        {expanded ? (
          <div className="border-t border-[var(--border)] px-2.5 pb-2.5 pt-2">
            <div className="flex items-center justify-between gap-2 text-[0.68rem] text-[var(--muted-foreground)]">
              <span>{checkedCount}/{expectedCount} pointés</span>
              <span>{item.unmarkedCount ?? 0} restant{(item.unmarkedCount ?? 0) > 1 ? "s" : ""}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-soft)]">
              <div
                className={`h-full rounded-full ${hasConflict ? "bg-[var(--danger)]" : "bg-[var(--primary)]"}`}
                style={{ width: `${progress}%` }}
              />
            </div>

            {conflictReasons.length > 0 ? (
              <div className="mt-2 rounded-md border border-[var(--danger)]/20 bg-[var(--danger)]/10 px-2 py-1.5">
                <p className="text-[0.68rem] font-semibold text-[var(--danger)]">À résoudre</p>
                <ul className="mt-1 space-y-0.5 text-[0.7rem] text-[var(--foreground)]">
                  {conflictReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[0.68rem] text-[var(--muted-foreground)]">
                  Modifiez l&apos;horaire, le coach, la salle ou les préférences du club.
                </p>
              </div>
            ) : null}

            <div className="mt-2 flex min-w-0 items-center gap-1.5">
              {actionIsAttendanceLink ? (
                <Link
                  href={attendanceHref(item)}
                  prefetch={false}
                  className={`btn btn-sm min-w-0 flex-1 ${
                    actionLabel === "Finaliser" || actionLabel === "Pointer" ? "btn-primary" : "btn-ghost"
                  }`}
                >
                  {actionLabel === "Finaliser" ? <AlertTriangle className="size-3.5" /> : null}
                  {actionLabel}
                </Link>
              ) : (
                <button type="button" onClick={() => onEdit(item)} className="btn btn-primary btn-sm min-w-0 flex-1">
                  Modifier
                </button>
              )}
              <details className="relative shrink-0">
                <summary className="btn btn-ghost btn-sm min-w-9 cursor-pointer list-none px-2" aria-label="Actions secondaires">
                  <MoreHorizontal className="size-4" />
                </summary>
                <div className="absolute right-0 z-20 mt-1 w-36 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-[var(--shadow-floating)]">
                  <button type="button" onClick={() => onEdit(item)} className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-soft)]">
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => onCancel(item)}
                    disabled={!canCancel}
                    title={
                      item.status === "CANCELLED"
                        ? "Séance déjà annulée"
                        : !canCancel
                          ? "Annulez les pointages depuis le pointage du jour avant d'annuler la séance"
                          : undefined
                    }
                    className="w-full rounded-md px-2 py-1.5 text-left text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    Annuler
                  </button>
                </div>
              </details>
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function SessionDetailPanel({
  session,
  conflictReasons,
  onEdit,
  onCancel,
  className,
}: {
  session: SessionDto | null;
  conflictReasons: string[];
  onEdit: (session: SessionDto) => void;
  onCancel: (session: SessionDto) => void;
  className?: string;
}) {
  if (!session) return null;

  const displayedStatus = displayedSessionStatus(session);
  const checkedCount = session.checkedMemberCount ?? session.attendanceCount ?? 0;
  const expectedCount = session.expectedMemberCount ?? 0;
  const progress = expectedCount > 0 ? Math.min(100, Math.round((checkedCount / expectedCount) * 100)) : 0;
  const actionLabel = primaryActionLabel(session);
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
          <h2 className="mt-1 truncate text-lg font-bold text-[var(--foreground)]">{session.groupName}</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {formatDateFr(session.sessionDate)} · {session.startTime} - {session.endTime}
          </p>
        </div>
        <StatusBadge variant={conflictReasons.length ? "danger" : displayedStatus.variant}>
          {conflictReasons.length ? "Conflit" : displayedStatus.label}
        </StatusBadge>
      </div>

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
            {session.unmarkedCount} eleve{session.unmarkedCount && session.unmarkedCount > 1 ? "s" : ""} restant{session.unmarkedCount && session.unmarkedCount > 1 ? "s" : ""}
          </p>
        ) : null}
      </div>

      {conflictReasons.length > 0 ? (
        <div className="mt-3 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/10 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--danger)]">À corriger</p>
          <ul className="mt-2 space-y-1 text-xs text-[var(--foreground)]">
            {conflictReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--muted-foreground)]">
            Solution: changer l&apos;horaire, le coach, la salle ou ajuster les préférences du club.
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {actionIsAttendanceLink ? (
          <Link
            href={attendanceHref(session)}
            prefetch={false}
            className={cn("btn btn-sm w-full", actionLabel === "Finaliser" || actionLabel === "Pointer" ? "btn-primary" : "btn-ghost")}
          >
            {actionLabel === "Finaliser" ? <AlertTriangle className="size-4" /> : null}
            {actionLabel}
          </Link>
        ) : null}
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
      </div>
    </aside>
  );
}
