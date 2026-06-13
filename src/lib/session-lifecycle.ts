import { getAppTimeZone, utcDateOnlyForTimeZone } from "@/lib/dates";

export type SessionOperationalStatus =
  | "UPCOMING"
  | "NEEDS_FINALIZATION"
  | "COMPLETED"
  | "CANCELLED";

type AssignmentWindow = {
  memberId: string;
  startDate: Date;
  endDate: Date | null;
};

function currentMinutesInTimeZone(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function isSessionEnded(
  sessionDate: Date,
  endTime: string,
  now: Date = new Date(),
  timeZone: string = getAppTimeZone(),
): boolean {
  const sessionDay = utcDateOnlyForTimeZone(sessionDate, timeZone);
  const today = utcDateOnlyForTimeZone(now, timeZone);
  if (sessionDay < today) return true;
  if (sessionDay > today) return false;
  return currentMinutesInTimeZone(now, timeZone) >= timeToMinutes(endTime);
}

export function expectedMemberIdsAtSession(
  assignments: AssignmentWindow[],
  sessionDate: Date,
): string[] {
  const day = utcDateOnlyForTimeZone(sessionDate);
  return assignments
    .filter((assignment) => {
      const start = utcDateOnlyForTimeZone(assignment.startDate);
      const end = assignment.endDate ? utcDateOnlyForTimeZone(assignment.endDate) : null;
      return start <= day && (!end || end >= day);
    })
    .map((assignment) => assignment.memberId);
}

export function deriveSessionLifecycle(params: {
  status: "PLANNED" | "RESCHEDULED" | "CANCELLED" | "COMPLETED";
  sessionDate: Date;
  endTime: string;
  expectedMemberIds: string[];
  attendanceMemberIds: string[];
  now?: Date;
}): {
  operationalStatus: SessionOperationalStatus;
  expectedMemberCount: number;
  checkedMemberCount: number;
  unmarkedCount: number;
  ended: boolean;
  canFinalize: boolean;
} {
  const expected = new Set(params.expectedMemberIds);
  const checked = new Set(
    params.attendanceMemberIds.filter((memberId) => expected.has(memberId)),
  );
  const unmarkedCount = Math.max(0, expected.size - checked.size);
  const ended = isSessionEnded(params.sessionDate, params.endTime, params.now);

  const operationalStatus: SessionOperationalStatus =
    params.status === "CANCELLED"
      ? "CANCELLED"
      : params.status === "COMPLETED"
        ? "COMPLETED"
        : ended
          ? "NEEDS_FINALIZATION"
          : "UPCOMING";

  return {
    operationalStatus,
    expectedMemberCount: expected.size,
    checkedMemberCount: checked.size,
    unmarkedCount,
    ended,
    canFinalize: operationalStatus === "NEEDS_FINALIZATION" && unmarkedCount === 0,
  };
}
