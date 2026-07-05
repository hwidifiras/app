export type DayOfWeekValue =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export const dayOrder: DayOfWeekValue[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const dayLabels: Record<DayOfWeekValue, string> = {
  MONDAY: "Lundi",
  TUESDAY: "Mardi",
  WEDNESDAY: "Mercredi",
  THURSDAY: "Jeudi",
  FRIDAY: "Vendredi",
  SATURDAY: "Samedi",
  SUNDAY: "Dimanche",
};

export type ScheduleRow = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  durationMinutes: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
};

export type DaySelection = {
  day: DayOfWeekValue;
  checked: boolean;
  startTime: string;
};

export type ScheduleStatus = "ACTIVE" | "FUTURE" | "PAST";

export function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function toDateInput(value: string | null | undefined) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export function inputDateToIso(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("fr-FR") : "Sans date de fin";
}

export function daySortIndex(day: string) {
  const index = dayOrder.indexOf(day as DayOfWeekValue);
  return index === -1 ? 99 : index;
}

export function getScheduleStatus(row: ScheduleRow, today = todayInputValue()): ScheduleStatus {
  const from = toDateInput(row.effectiveFrom);
  const to = toDateInput(row.effectiveTo);
  if (from && to && to < from) return "PAST";
  if (from && today < from) return "FUTURE";
  if (to && today > to) return "PAST";
  return "ACTIVE";
}

export function statusLabel(status: ScheduleStatus) {
  if (status === "ACTIVE") return "Actuelle";
  if (status === "FUTURE") return "À venir";
  return "Terminée";
}

export function statusClass(status: ScheduleStatus) {
  if (status === "ACTIVE") return "bg-[var(--success)]/10 text-[var(--success)]";
  if (status === "FUTURE") return "bg-[var(--primary)]/10 text-[var(--primary)]";
  return "bg-[var(--surface-soft)] text-[var(--muted-foreground)]";
}

export function formatPeriod(from: string, to: string | null) {
  return `Du ${formatDate(from)} au ${formatDate(to)}`;
}

export function emptyDaySelections(): DaySelection[] {
  return dayOrder.map((day) => ({
    day,
    checked: false,
    startTime: "18:00",
  }));
}
