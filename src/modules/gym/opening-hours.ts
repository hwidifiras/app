import { dayOfWeekEnumFromDate, getAppTimeZone } from "@/lib/dates";

export const GYM_DAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export type GymOpeningDay = (typeof GYM_DAY_ORDER)[number];

export type GymOpeningWindow = {
  dayOfWeek: GymOpeningDay;
  opensAt: string;
  closesAt: string;
};

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function gymTimeToMinutes(value: string): number | null {
  if (!TIME_PATTERN.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function normalizeGymOpeningHours(value: unknown): GymOpeningWindow[] {
  if (!Array.isArray(value)) return [];

  const normalized = value.flatMap((entry): GymOpeningWindow[] => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const dayOfWeek = typeof row.dayOfWeek === "string" ? row.dayOfWeek : "";
    const opensAt = typeof row.opensAt === "string" ? row.opensAt : "";
    const closesAt = typeof row.closesAt === "string" ? row.closesAt : "";
    if (!GYM_DAY_ORDER.includes(dayOfWeek as GymOpeningDay)) return [];
    const openMinutes = gymTimeToMinutes(opensAt);
    const closeMinutes = gymTimeToMinutes(closesAt);
    if (openMinutes === null || closeMinutes === null || openMinutes >= closeMinutes) return [];
    return [{ dayOfWeek: dayOfWeek as GymOpeningDay, opensAt, closesAt }];
  });

  return normalized.sort((left, right) => {
    const dayDifference = GYM_DAY_ORDER.indexOf(left.dayOfWeek) - GYM_DAY_ORDER.indexOf(right.dayOfWeek);
    if (dayDifference !== 0) return dayDifference;
    return (gymTimeToMinutes(left.opensAt) ?? 0) - (gymTimeToMinutes(right.opensAt) ?? 0);
  });
}

export function findGymOpeningHoursOverlap(windows: GymOpeningWindow[]): GymOpeningDay | null {
  for (const day of GYM_DAY_ORDER) {
    const rows = windows
      .filter((window) => window.dayOfWeek === day)
      .sort((left, right) => (gymTimeToMinutes(left.opensAt) ?? 0) - (gymTimeToMinutes(right.opensAt) ?? 0));
    for (let index = 1; index < rows.length; index += 1) {
      const previousClose = gymTimeToMinutes(rows[index - 1].closesAt) ?? 0;
      const currentOpen = gymTimeToMinutes(rows[index].opensAt) ?? 0;
      if (currentOpen < previousClose) return day;
    }
  }
  return null;
}

function minutesInTimeZone(now: Date, timeZone: string): number {
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

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function localMidnightUtc(year: number, month: number, day: number, timeZone: string): Date {
  const target = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  let guess = target;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const rendered = zonedParts(new Date(guess), timeZone);
    const renderedAsUtc = Date.UTC(
      rendered.year,
      rendered.month - 1,
      rendered.day,
      rendered.hour,
      rendered.minute,
      rendered.second,
    );
    guess -= renderedAsUtc - target;
  }
  return new Date(guess);
}

export function gymLocalDayRange(now: Date, timeZone: string = getAppTimeZone()) {
  const current = zonedParts(now, timeZone);
  const start = localMidnightUtc(current.year, current.month, current.day, timeZone);
  const nextCalendarDay = new Date(Date.UTC(current.year, current.month - 1, current.day + 1));
  const end = localMidnightUtc(
    nextCalendarDay.getUTCFullYear(),
    nextCalendarDay.getUTCMonth() + 1,
    nextCalendarDay.getUTCDate(),
    timeZone,
  );
  return { start, end };
}

export function isGymOpenAt(
  windows: GymOpeningWindow[],
  now: Date,
  timeZone: string = getAppTimeZone(),
): boolean {
  const day = dayOfWeekEnumFromDate(now, timeZone);
  const currentMinutes = minutesInTimeZone(now, timeZone);
  return windows.some((window) => {
    if (window.dayOfWeek !== day) return false;
    const opensAt = gymTimeToMinutes(window.opensAt);
    const closesAt = gymTimeToMinutes(window.closesAt);
    return opensAt !== null && closesAt !== null && currentMinutes >= opensAt && currentMinutes < closesAt;
  });
}
