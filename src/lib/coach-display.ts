type CoachDisplayLike = {
  firstName: string;
  lastName: string;
  sportName?: string | null;
  qualifiedSportIds?: string[];
  qualifiedSports?: Array<{ name: string }>;
};

export function formatCoachName(coach: Pick<CoachDisplayLike, "firstName" | "lastName"> | undefined | null) {
  if (!coach) return null;
  return `${coach.firstName} ${coach.lastName}`.trim();
}

export function formatCoachOptionLabel(coach: CoachDisplayLike) {
  const name = formatCoachName(coach) ?? "";
  const qualified = coach.qualifiedSports?.map((sport) => sport.name).join(", ") ?? "";
  return qualified ? `${name} - ${qualified}` : coach.sportName ? `${name} - ${coach.sportName}` : name;
}

export function isCoachQualifiedForSport(
  coach: Pick<CoachDisplayLike, "qualifiedSportIds"> | undefined | null,
  sportId?: string | null,
) {
  if (!coach || !sportId) return true;
  return coach.qualifiedSportIds?.includes(sportId) ?? true;
}
