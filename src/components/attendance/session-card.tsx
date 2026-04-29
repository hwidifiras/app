"use client";

import { Clock, Users, DoorOpen, AlertTriangle, CheckCircle2, XCircle, HelpCircle, User } from "lucide-react";

export type SessionCardData = {
  id: string;
  startTime: string;
  endTime: string;
  room: string;
  status: string;
  group: {
    id: string;
    name: string;
    members: Array<{ id: string; memberId: string; member: { id: string; firstName: string; lastName: string } }>;
  };
  coach: { firstName: string; lastName: string } | null;
  attendances: Array<{ id: string; memberId: string; status: string }>;
};

export type WindowState = "UPCOMING" | "OPEN" | "CLOSED";

function buildSessionStart(startTime: string, now: Date): Date {
  const [h, m] = startTime.split(":").map(Number);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0, 0));
}

export function getWindowState(startTime: string, now: Date): WindowState {
  const sessionStart = buildSessionStart(startTime, now);
  const windowStart = new Date(sessionStart.getTime() - 30 * 60 * 1000);
  const windowEnd = new Date(sessionStart.getTime() + 30 * 60 * 1000);

  if (now < windowStart) return "UPCOMING";
  if (now <= windowEnd) return "OPEN";
  return "CLOSED";
}

export function getWindowLabel(startTime: string, now: Date): string {
  const state = getWindowState(startTime, now);
  const sessionStart = buildSessionStart(startTime, now);

  if (state === "UPCOMING") {
    const diffMin = Math.ceil((sessionStart.getTime() - now.getTime()) / 60000);
    const diffH = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;
    if (diffH > 0) return `Ouverture dans ${diffH}h${remMin > 0 ? ` ${remMin}min` : ""}`;
    return `Ouverture dans ${diffMin} min`;
  }
  if (state === "OPEN") {
    const windowEnd = new Date(sessionStart.getTime() + 30 * 60 * 1000);
    const diffMin = Math.ceil((windowEnd.getTime() - now.getTime()) / 60000);
    return `Pointage fermeture dans ${diffMin} min`;
  }
  return "Pointage fermé";
}

export function SessionCard({
  session,
  now,
  isSelected,
  onSelect,
  onCoachAbsent,
}: {
  session: SessionCardData;
  now: Date;
  isSelected: boolean;
  onSelect: () => void;
  onCoachAbsent: () => void;
}) {
  const state = getWindowState(session.startTime, now);
  const label = getWindowLabel(session.startTime, now);

  const present = session.attendances.filter((a) => a.status === "PRESENT").length;
  const absent = session.attendances.filter((a) => a.status === "ABSENT").length;
  const excused = session.attendances.filter((a) => a.status === "EXCUSED").length;
  const total = session.group.members.length;
  const checked = present + absent + excused;
  const remaining = total - checked;
  const progress = total > 0 ? Math.round((checked / total) * 100) : 0;

  const stateStyles: Record<WindowState, string> = {
    UPCOMING: "border-dashed border-[var(--border)] bg-white",
    OPEN: "border-[var(--success)] bg-[var(--success)]/[0.02] shadow-[0_0_0_1px_rgba(16,185,129,0.15)]",
    CLOSED: "border-[var(--border)] bg-[var(--surface-soft)] opacity-70",
  };

  const stateBadge: Record<WindowState, { text: string; className: string; icon: React.ReactNode }> = {
    UPCOMING: {
      text: "À venir",
      className: "bg-[var(--info)]/10 text-[var(--info)] border-[var(--info)]/20",
      icon: <Clock className="size-3" />,
    },
    OPEN: {
      text: "Pointage ouvert",
      className: "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20",
      icon: <CheckCircle2 className="size-3" />,
    },
    CLOSED: {
      text: "Fermé",
      className: "bg-[var(--muted)]/10 text-[var(--muted-foreground)] border-[var(--border)]",
      icon: <XCircle className="size-3" />,
    },
  };

  const isDisabled = state === "CLOSED";

  // Mini preview: first 3 checked-in members
  const checkedMembers = session.attendances
    .filter((a) => a.status === "PRESENT")
    .slice(0, 3)
    .map((a) => {
      const gm = session.group.members.find((m) => m.memberId === a.memberId);
      return gm?.member ? `${gm.member.firstName[0]}${gm.member.lastName[0]}` : null;
    })
    .filter(Boolean) as string[];

  return (
    <div
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-disabled={isDisabled}
      onClick={isDisabled ? undefined : onSelect}
      onKeyDown={isDisabled ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") onSelect(); }}
      className={`relative w-full rounded-xl border transition-all ${
        isSelected && state === "OPEN"
          ? "ring-2 ring-[var(--success)] shadow-lg shadow-[var(--success)]/10"
          : ""
      } ${stateStyles[state]} ${isDisabled ? "cursor-not-allowed" : "cursor-pointer hover:shadow-lg"}`}
    >
      {/* Top accent bar */}
      {state === "OPEN" && (
        <div className="absolute left-0 top-0 h-1.5 w-full rounded-t-xl bg-[var(--success)]" />
      )}
      {state === "UPCOMING" && (
        <div className="absolute left-0 top-0 h-1 w-full rounded-t-xl bg-[var(--info)]" />
      )}

      {/* OPEN pulsing indicator */}
      {state === "OPEN" && !isSelected && (
        <div className="absolute -top-1.5 -right-1.5">
          <span className="relative flex size-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-40" />
            <span className="relative inline-flex size-3 rounded-full bg-[var(--success)]" />
          </span>
        </div>
      )}

      <div className="p-4 pt-5">
        {/* Header: Group name + Status badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-[var(--foreground)] leading-tight truncate">
              {session.group.name}
            </h3>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold ${stateBadge[state].className}`}>
            {stateBadge[state].icon}
            {stateBadge[state].text}
          </span>
        </div>

        {/* Time row - PROMINENT */}
        <div className="mt-3 flex items-center gap-3">
          <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold ${
            state === "OPEN"
              ? "bg-[var(--success)] text-white shadow-sm"
              : state === "UPCOMING"
              ? "bg-[var(--info)]/10 text-[var(--info)]"
              : "bg-[var(--surface-soft)] text-[var(--muted-foreground)]"
          }`}>
            <Clock className="size-4" />
            {session.startTime}
            <span className={`font-normal ${state === "OPEN" ? "text-white/80" : "opacity-70"}`}>– {session.endTime}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
            <DoorOpen className="size-3" />
            {session.room}
          </div>
        </div>

        {/* OPEN click hint */}
        {state === "OPEN" && !isSelected && (
          <div className="mt-2 flex items-center gap-1.5 text-[0.65rem] font-medium text-[var(--success)]">
            <span className="inline-flex size-1.5 rounded-full bg-[var(--success)] animate-pulse" />
            Cliquez pour pointer les membres
          </div>
        )}
        {state === "OPEN" && isSelected && (
          <div className="mt-2 flex items-center gap-1.5 text-[0.65rem] font-medium text-[var(--primary)]">
            <CheckCircle2 className="size-3" />
            Pointage actif — sélectionnez un statut
          </div>
        )}

        {/* Coach row */}
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          <div className="flex size-5 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[0.65rem] font-bold">
            {session.coach ? `${session.coach.firstName[0]}` : <User className="size-3" />}
          </div>
          <span className="truncate">
            {session.coach ? `${session.coach.firstName} ${session.coach.lastName}` : "Pas de coach"}
          </span>
        </div>

        {/* Attendance progress bar */}
        {total > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[0.65rem] text-[var(--muted-foreground)] mb-1">
              <span>Pointage</span>
              <span>{checked}/{total} membres</span>
            </div>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
              <div
                className="h-full rounded-full bg-[var(--success)] transition-all"
                style={{ width: `${(present / total) * 100}%` }}
              />
              <div
                className="h-full rounded-full bg-[var(--danger)] transition-all"
                style={{ width: `${(absent / total) * 100}%` }}
              />
              <div
                className="h-full rounded-full bg-[var(--info)] transition-all"
                style={{ width: `${(excused / total) * 100}%` }}
              />
            </div>
            <div className="mt-1 flex items-center gap-3 text-[0.65rem]">
              {present > 0 && (
                <span className="flex items-center gap-1 text-[var(--success)]">
                  <CheckCircle2 className="size-3" />
                  {present}
                </span>
              )}
              {absent > 0 && (
                <span className="flex items-center gap-1 text-[var(--danger)]">
                  <XCircle className="size-3" />
                  {absent}
                </span>
              )}
              {excused > 0 && (
                <span className="flex items-center gap-1 text-[var(--info)]">
                  <HelpCircle className="size-3" />
                  {excused}
                </span>
              )}
              {remaining > 0 && (
                <span className="flex items-center gap-1 text-[var(--muted-foreground)]">
                  <Users className="size-3" />
                  {remaining} à pointer
                </span>
              )}
              {remaining === 0 && (
                <span className="flex items-center gap-1 text-[var(--success)] font-medium">
                  <CheckCircle2 className="size-3" />
                  Complet
                </span>
              )}
            </div>
          </div>
        )}

        {/* Mini member avatars preview */}
        {checkedMembers.length > 0 && (
          <div className="mt-2 flex items-center gap-1">
            <div className="flex -space-x-1.5">
              {checkedMembers.map((initials, i) => (
                <div
                  key={i}
                  className="flex size-5 items-center justify-center rounded-full bg-[var(--success)]/15 text-[var(--success)] text-[0.6rem] font-bold ring-1 ring-white"
                >
                  {initials}
                </div>
              ))}
            </div>
            {session.attendances.filter((a) => a.status === "PRESENT").length > 3 && (
              <span className="text-[0.6rem] text-[var(--muted-foreground)] ml-1">
                +{session.attendances.filter((a) => a.status === "PRESENT").length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer: Time label + Coach absent button */}
        <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-2.5">
          <div className="flex items-center gap-1.5">
            <Clock className="size-3 text-[var(--muted-foreground)]" />
            <p className="text-[0.65rem] text-[var(--muted-foreground)]">{label}</p>
          </div>
          {(state === "OPEN" || state === "UPCOMING") && (
            <button
              onClick={(e) => { e.stopPropagation(); onCoachAbsent(); }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.65rem] font-medium text-[var(--warning)] hover:bg-[var(--warning)]/10 transition-colors"
              title="Signaler coach absent"
            >
              <AlertTriangle className="size-3" />
              Coach absent
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
