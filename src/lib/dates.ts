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
