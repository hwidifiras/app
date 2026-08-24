"use client";

import { Clock, MapPin, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

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
  isSelected,
  onSelect,
}: {
  session: SessionCardData;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const expected = session.expectedMemberCount ?? session.group.members.length;
  const checked = session.checkedMemberCount ?? session.attendances.length;
  const needsFinalization = session.operationalStatus === "NEEDS_FINALIZATION";
  const isCompleted = session.operationalStatus === "COMPLETED" || session.status === "COMPLETED";

  return (
    <article>
      <button
        id={`attendance-session-${session.id}`}
        type="button"
        onClick={onSelect}
        aria-pressed={isSelected}
        aria-controls="attendance-roster-panel"
        className={cn(
          "group relative min-h-[6.5rem] w-full rounded-lg border bg-[var(--surface)] px-4 py-3 text-left shadow-[var(--shadow-panel)] transition",
          "hover:border-[var(--primary)]/55 hover:shadow-[var(--shadow-floating)]",
          isSelected && "border-[var(--primary)] bg-[var(--primary)]/[0.045] ring-2 ring-[var(--primary)]/18",
          !isSelected && needsFinalization && "border-[var(--warning)]/45",
          !isSelected && isCompleted && "border-[var(--success)]/30",
        )}
      >
        <span
          className={cn(
            "absolute inset-y-3 left-0 w-1 rounded-r-full bg-[var(--border)]",
            isSelected && "bg-[var(--primary)]",
            !isSelected && needsFinalization && "bg-[var(--warning)]",
            !isSelected && isCompleted && "bg-[var(--success)]",
          )}
          aria-hidden
        />
        <span className="flex items-start justify-between gap-4">
          <span className="min-w-0 flex-1">
            {session.dateCategory !== "TODAY" ? (
              <span
                className={cn(
                  "mb-1 block text-[0.68rem] font-bold uppercase tracking-[0.12em]",
                  needsFinalization ? "text-[var(--warning)]" : "text-[var(--primary)]",
                )}
              >
                {sessionDateLabel(session.sessionDate)}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5 text-base font-bold text-[var(--primary)]">
              <Clock className="size-4" aria-hidden />
              {session.startTime} – {session.endTime}
            </span>
            <span className="mt-1 block truncate text-sm font-semibold text-[var(--foreground)]">
              {session.group.name}
            </span>
            <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {session.room?.trim() || "Salle à définir"}
              </span>
              <span className="inline-flex items-center gap-1">
                <UserRound className="size-3.5" aria-hidden />
                {session.coach ? `${session.coach.firstName} ${session.coach.lastName}` : "Coach à définir"}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-sm font-bold tabular-nums text-[var(--foreground)]">
              {checked}/{expected}
            </span>
            <span className="block text-[0.68rem] text-[var(--muted-foreground)]">pointés</span>
          </span>
        </span>
      </button>
    </article>
  );
}
