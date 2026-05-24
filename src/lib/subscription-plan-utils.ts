export const WEEKS_PER_MONTH = 4;

export function totalSessionsFromWeekly(sessionsPerWeek: number): number {
  return sessionsPerWeek * WEEKS_PER_MONTH;
}
