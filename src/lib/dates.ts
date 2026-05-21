const DEFAULT_TIMEZONE = "Africa/Tunis";

export function getAppTimeZone(): string {
  return process.env.APP_TIMEZONE?.trim() || DEFAULT_TIMEZONE;
}

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const value = parts.find((p) => p.type === type)?.value;
  if (!value) {
    throw new Error(`Missing date part: ${type}`);
  }
  return value;
}

/**
 * Returns a Date set to UTC midnight for the calendar day of `date` in `timeZone`.
 *
 * This is a robust way to store/query a "date-only" field consistently even when
 * the server runs in UTC and the club operates in another time zone.
 */
export function utcDateOnlyForTimeZone(date: Date, timeZone: string = getAppTimeZone()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = Number(getPart(parts, "year"));
  const month = Number(getPart(parts, "month"));
  const day = Number(getPart(parts, "day"));

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

export function getWeekRangeUtc(date: Date, timeZone: string = getAppTimeZone()): { start: Date; end: Date } {
  const day = utcDateOnlyForTimeZone(date, timeZone);
  const weekday = day.getUTCDay();
  const diffToMonday = (weekday + 6) % 7;
  const start = new Date(day);
  start.setUTCDate(start.getUTCDate() - diffToMonday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

/** Monday of the week containing `date`, as YYYY-MM-DD (club calendar). */
export function weekStartIsoForDate(date: Date, timeZone: string = getAppTimeZone()): string {
  const { start } = getWeekRangeUtc(date, timeZone);
  return formatUtcDateOnlyIso(start);
}

export function formatUtcDateOnlyIso(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Inclusive Monday + exclusive next Monday (7-day window). */
export function getWeekRangeFromStartIso(weekStartIso: string): { start: Date; end: Date } {
  const [year, month, day] = weekStartIso.split("-").map((value) => Number(value));
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

export function addWeeksToStartIso(weekStartIso: string, offsetWeeks: number): string {
  const { start } = getWeekRangeFromStartIso(weekStartIso);
  const next = new Date(start);
  next.setUTCDate(next.getUTCDate() + offsetWeeks * 7);
  return formatUtcDateOnlyIso(next);
}

/** Sunday of the week (for display), from Monday ISO. */
export function weekEndIsoFromStartIso(weekStartIso: string): string {
  const { start } = getWeekRangeFromStartIso(weekStartIso);
  const sunday = new Date(start);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return formatUtcDateOnlyIso(sunday);
}

const UTC_DAY_TO_ENUM = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

export type ClubDayOfWeek = (typeof UTC_DAY_TO_ENUM)[number];

/** Weekday index 0=Sunday … 6=Saturday for a club calendar date. */
export function utcWeekdayIndex(date: Date, timeZone: string = getAppTimeZone()): number {
  return utcDateOnlyForTimeZone(date, timeZone).getUTCDay();
}

export function dayOfWeekEnumFromDate(date: Date, timeZone: string = getAppTimeZone()): ClubDayOfWeek {
  return UTC_DAY_TO_ENUM[utcWeekdayIndex(date, timeZone)];
}

/** Same Mon–Sun week as `referenceDate`, on `targetWeekday` (0=Sun … 6=Sat). */
export function sessionDateOnWeekdayInSameWeek(
  referenceDate: Date,
  targetWeekday: number,
  timeZone: string = getAppTimeZone(),
): Date {
  const { start: monday } = getWeekRangeUtc(referenceDate, timeZone);
  const offset = targetWeekday === 0 ? 6 : targetWeekday - 1;
  const result = new Date(monday);
  result.setUTCDate(result.getUTCDate() + offset);
  return result;
}
