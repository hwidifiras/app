export type AttendanceQueueKind = "NOW" | "NEXT" | "REGULARIZE" | "DONE";

export type TenantClock = {
  dayIso: string;
  minutes: number;
};

type AttendanceQueueSession = {
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: string;
  operationalStatus?: "UPCOMING" | "NEEDS_FINALIZATION" | "COMPLETED" | "CANCELLED";
  unmarkedCount?: number;
};

export type EffectiveAttendanceQueueState = {
  operationalStatus: "UPCOMING" | "NEEDS_FINALIZATION" | "COMPLETED" | "CANCELLED";
  dateCategory: "OVERDUE" | "TODAY" | "UPCOMING";
  queueKind: AttendanceQueueKind | null;
  ended: boolean;
  canFinalize: boolean;
};

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function sessionDayIso(value: string): string {
  const dateOnly = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateOnly) return dateOnly;
  return new Date(value).toISOString().slice(0, 10);
}

/** Returns the club-local calendar day and minute from the same instant. */
export function tenantClockAt(date: Date, timeZone: string): TenantClock {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "00";

  return {
    dayIso: `${part("year")}-${part("month")}-${part("day")}`,
    minutes: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

/**
 * Re-derives the operational queue from the live tenant clock.
 *
 * The server snapshot can remain mounted while a class ends or the tenant day
 * rolls over. Keeping this derivation separate from the attendance records lets
 * those records (including optimistic check-ins) stay intact at either boundary.
 */
export function deriveEffectiveAttendanceQueueState(
  session: AttendanceQueueSession,
  clock: TenantClock,
): EffectiveAttendanceQueueState {
  const sessionDay = sessionDayIso(session.sessionDate);
  const dateCategory =
    sessionDay < clock.dayIso
      ? "OVERDUE"
      : sessionDay === clock.dayIso
        ? "TODAY"
        : "UPCOMING";
  const ended =
    sessionDay < clock.dayIso
    || (sessionDay === clock.dayIso && clock.minutes >= timeToMinutes(session.endTime));
  const isCompleted = session.status === "COMPLETED" || session.operationalStatus === "COMPLETED";
  const isCancelled = session.status === "CANCELLED" || session.operationalStatus === "CANCELLED";
  const operationalStatus = isCancelled
    ? "CANCELLED"
    : isCompleted
      ? "COMPLETED"
      : ended
        ? "NEEDS_FINALIZATION"
        : "UPCOMING";
  const isHappeningNow =
    operationalStatus === "UPCOMING"
    && dateCategory === "TODAY"
    && clock.minutes >= timeToMinutes(session.startTime)
    && clock.minutes < timeToMinutes(session.endTime);
  const queueKind =
    operationalStatus === "CANCELLED"
      ? null
      : operationalStatus === "COMPLETED"
        ? "DONE"
        : operationalStatus === "NEEDS_FINALIZATION"
          ? "REGULARIZE"
          : isHappeningNow
            ? "NOW"
            : "NEXT";

  return {
    operationalStatus,
    dateCategory,
    queueKind,
    ended,
    canFinalize: operationalStatus === "NEEDS_FINALIZATION" && (session.unmarkedCount ?? 0) === 0,
  };
}
