import type { CoachDto } from "@/types/coach";

export function withPrimarySport(ids: string[], primarySportId: string) {
  const normalized = new Set(ids.filter(Boolean));
  if (primarySportId) normalized.add(primarySportId);
  return Array.from(normalized);
}

export function toggleSportId(ids: string[], sportId: string) {
  return ids.includes(sportId)
    ? ids.filter((id) => id !== sportId)
    : [...ids, sportId];
}

export function qualifiedSportNames(coach: CoachDto) {
  return coach.qualifiedSports.map((sport) => sport.name).join(", ");
}
