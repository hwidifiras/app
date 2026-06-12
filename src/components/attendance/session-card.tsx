"use client";

import Link from "next/link";
import { Clock, Users, DoorOpen, CalendarClock, CheckCircle2, XCircle, User } from "lucide-react";

export type SessionCardData = {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  room: string;
  status: string;
  postponedTo: string | null;
  postponementDetails: string | null;
  group: {
    id: string;
    name: string;
    members: Array<{ id: string; memberId: string; member: { id: string; firstName: string; lastName: string } }>;
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
export function SessionCard({
  session,
  isSelected,
  onSelect,
  postponeHref,
  postponeDisabled = false,
}: {
  session: SessionCardData;
  isSelected: boolean;
  onSelect: () => void;
  postponeHref: string;
  postponeDisabled?: boolean;
}) {
  const label = "Pointage disponible";
  const postponementInfo = (() => {
    if (!session.postponementDetails) return null;
    try {
      const parsed = JSON.parse(session.postponementDetails) as {
        original?: { date?: string; startTime?: string; endTime?: string };
        postponedAt?: string;
      };
      if (!parsed.original?.date || !parsed.original?.startTime) return null;
      return {
        originalDate: parsed.original.date,
        originalStart: parsed.original.startTime,
        postponedAt: parsed.postponedAt,
      };
    } catch {
      return null;
    }
  })();

  const present = session.attendances.filter((a) => a.status === "PRESENT").length;
  const absent = session.attendances.filter((a) => a.status === "ABSENT").length;
  const total = session.group.members.length;
  const checked = present + absent;
  const remaining = total - checked;
  const badge = {
    text: "Pointage",
    className: "bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20",
    icon: <CheckCircle2 className="size-3" />,
  };

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
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(); }}
      className={`relative w-full overflow-hidden rounded-xl border border-[var(--success)] bg-[var(--success)]/[0.02] transition-all ${
        isSelected
          ? "ring-2 ring-[var(--success)] shadow-lg shadow-[var(--success)]/10"
          : ""
      } cursor-pointer hover:shadow-lg`}
    >
      <div className="p-4">
        {/* Header: Group name + Status badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-[var(--foreground)] leading-tight truncate">
              {session.group.name}
            </h3>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold ${badge.className}`}>
            {!isSelected ? (
              <span className="relative flex size-2 shrink-0" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--success)] opacity-40" />
                <span className="relative inline-flex size-2 rounded-full bg-[var(--success)]" />
              </span>
            ) : (
              badge.icon
            )}
            {badge.text}
          </span>
        </div>

        {/* Time row - PROMINENT */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-bold bg-[var(--success)] text-white shadow-sm">
            <Clock className="size-4" />
            {session.startTime}
            <span className="font-normal text-white/80">– {session.endTime}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
            <DoorOpen className="size-3" />
            {session.room?.trim() ? session.room : "À définir"}
          </div>
        </div>

        {/* OPEN click hint */}
        {!isSelected && (
          <div className="mt-2 flex items-center gap-1.5 text-[0.65rem] font-medium text-[var(--success)]">
            <span className="inline-flex size-1.5 rounded-full bg-[var(--success)] animate-pulse" />
            Cliquez pour pointer les membres
          </div>
        )}
        {isSelected && (
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

        {session.status === "RESCHEDULED" && postponementInfo ? (
          <div className="mt-2 text-[0.65rem] text-[var(--warning)]">
            Reportee depuis {new Date(postponementInfo.originalDate).toLocaleDateString("fr-FR")} a {postponementInfo.originalStart}
          </div>
        ) : null}

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

        {/* Footer: Time label + Postpone button */}
        <div className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-2.5">
          <div className="flex items-center gap-1.5">
            <Clock className="size-3 text-[var(--muted-foreground)]" />
            <p className="text-[0.65rem] text-[var(--muted-foreground)]">{label}</p>
          </div>
          {postponeDisabled ? (
            <span
              className="inline-flex cursor-not-allowed items-center gap-1 rounded-md px-2 py-1 text-[0.65rem] font-medium text-[var(--muted-foreground)] opacity-60"
              title="Annulez les pointages (↶) avant de reporter la séance"
            >
              <CalendarClock className="size-3" />
              Reporter
            </span>
          ) : (
            <Link
              href={postponeHref}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[0.65rem] font-medium text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
              title="Modifier le créneau ou reporter via le planning du groupe"
            >
              <CalendarClock className="size-3" />
              Reporter
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
