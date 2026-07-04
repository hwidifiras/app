export const CLUB_DAY_VALUES = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

export type ClubDay = (typeof CLUB_DAY_VALUES)[number];

export const WORKING_DAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const satisfies readonly ClubDay[];

export const DEFAULT_WORKING_DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const satisfies readonly ClubDay[];

export const DAY_INDEX_TO_CLUB_DAY = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const satisfies readonly ClubDay[];

export const CLUB_DAY_LABELS: Record<ClubDay, string> = {
  SUNDAY: "Dimanche",
  MONDAY: "Lundi",
  TUESDAY: "Mardi",
  WEDNESDAY: "Mercredi",
  THURSDAY: "Jeudi",
  FRIDAY: "Vendredi",
  SATURDAY: "Samedi",
};

export const CLUB_DAY_SHORT_LABELS: Record<ClubDay, string> = {
  SUNDAY: "Dim.",
  MONDAY: "Lun.",
  TUESDAY: "Mar.",
  WEDNESDAY: "Mer.",
  THURSDAY: "Jeu.",
  FRIDAY: "Ven.",
  SATURDAY: "Sam.",
};

export function normalizeWorkingDays(value: unknown): ClubDay[] {
  if (!Array.isArray(value)) return [...DEFAULT_WORKING_DAYS];

  const selected = new Set(value.filter((day): day is ClubDay => CLUB_DAY_VALUES.includes(day as ClubDay)));
  if (selected.size === 0) return [...DEFAULT_WORKING_DAYS];

  return WORKING_DAY_ORDER.filter((day) => selected.has(day));
}
