"use client";

import { ArrowRight, CalendarClock, CheckCircle2, MapPin, PlayCircle, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AttendanceQueueKind } from "@/lib/attendance-queue";

export type { AttendanceQueueKind } from "@/lib/attendance-queue";

export type SessionCardData = {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  room: string;
  status: string;
  operationalStatus?: "UPCOMING" | "NEEDS_FINALIZATION" | "COMPLETED" | "CANCELLED";
  dateCategory?: "OVERDUE" | "TODAY" | "UPCOMING";
  expectedMemberCount?: number;
  checkedMemberCount?: number;
  unmarkedCount?: number;
  canFinalize?: boolean;
  postponedTo: string | null;
  postponementDetails: string | null;
  group: {
    id: string;
    name: string;
    members: Array<{
      id: string;
      memberId: string;
      member: { id: string; firstName: string; lastName: string };
    }>;
  };
  coach: { firstName: string; lastName: string } | null;
  attendances: Array<{
    id: string;
    memberId: string;
    status: string;
    overrideReason?: string | null;
    checkedAt?: string;
  }>;
};

function sessionDateLabel(value: string) {
  return new Date(value).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function SessionCard({
  session,
  kind,
  isSelected,
  readOnly = false,
  onSelect,
}: {
  session: SessionCardData;
  kind: AttendanceQueueKind;
  isSelected: boolean;
  readOnly?: boolean;
  onSelect: () => void;
}) {
  const expected = session.expectedMemberCount ?? session.group.members.length;
  const checked = session.checkedMemberCount ?? session.attendances.length;
  const unmarked = Math.max(0, session.unmarkedCount ?? expected - checked);
  const coachName = session.coach
    ? `${session.coach.firstName} ${session.coach.lastName}`
    : "Coach à définir";
  const dateLabel = sessionDateLabel(session.sessionDate);
  const statusLabel =
    kind === "NOW"
      ? "Séance en cours"
      : kind === "REGULARIZE"
        ? unmarked > 0
          ? `${unmarked} à pointer`
          : "Prête à finaliser"
        : kind === "DONE"
          ? "Séance finalisée"
          : session.dateCategory === "TODAY"
            ? "Plus tard aujourd’hui"
            : dateLabel;
  const actionLabel = readOnly
    ? "Consulter"
    : kind === "NOW"
      ? "Ouvrir le pointage"
      : kind === "NEXT"
        ? "Préparer la séance"
        : kind === "REGULARIZE"
          ? "Régulariser"
          : "Consulter";
  const ActionIcon =
    kind === "NOW"
      ? PlayCircle
      : kind === "NEXT"
        ? CalendarClock
        : kind === "DONE"
          ? CheckCircle2
          : ArrowRight;

  return (
    <article className="attendance-session-item">
      <button
        id={`attendance-session-${session.id}`}
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        aria-controls="attendance-roster-panel"
        aria-label={`${actionLabel} : ${session.group.name}, ${session.startTime} à ${session.endTime}`}
        className={cn(
          "attendance-session-row",
          `attendance-session-row-${kind.toLowerCase()}`,
          isSelected && "is-selected",
        )}
      >
        <span className="attendance-session-time">
          <strong>{session.startTime}</strong>
          <span aria-hidden>–</span>
          <strong>{session.endTime}</strong>
          {session.dateCategory !== "TODAY" ? <small>{dateLabel}</small> : null}
        </span>

        <span className="attendance-session-summary">
          <strong>{session.group.name}</strong>
          <span className="attendance-session-meta">
            <span><MapPin aria-hidden />{session.room?.trim() || "Salle à définir"}</span>
            <span><UserRound aria-hidden />{coachName}</span>
          </span>
        </span>

        <span className="attendance-session-progress">
          <strong className="tabular-nums">{checked}/{expected}</strong>
          <span>pointés</span>
          <small>{statusLabel}</small>
        </span>

        <span
          className={cn(
            "attendance-session-action",
            kind === "NOW" && !readOnly && "attendance-session-action-primary",
          )}
          aria-hidden
        >
          <ActionIcon />
          <span>{actionLabel}</span>
        </span>
      </button>
    </article>
  );
}
