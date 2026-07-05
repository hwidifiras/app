import type { CoachDto } from "@/types/coach";

export type CoachViewModelInput = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  isActive: boolean;
  sportId: string | null;
  createdAt: Date;
  updatedAt: Date;
  sport: { id: string; name: string } | null;
  qualifications: Array<{
    sportId: string;
    isPrimary: boolean;
    sport: { id: string; name: string };
  }>;
  groups?: Array<{
    id: string;
    name: string;
    room: string | null;
    sport: { name: string } | null;
    schedules: Array<{ id: string }>;
  }>;
};

export function buildCoachDto(coach: CoachViewModelInput): CoachDto {
  const qualifiedSportsById = new Map<string, { id: string; name: string; isPrimary: boolean }>();

  for (const qualification of coach.qualifications) {
    qualifiedSportsById.set(qualification.sport.id, {
      id: qualification.sport.id,
      name: qualification.sport.name,
      isPrimary: qualification.isPrimary,
    });
  }

  if (coach.sport) {
    qualifiedSportsById.set(coach.sport.id, {
      id: coach.sport.id,
      name: coach.sport.name,
      isPrimary: true,
    });
  }

  const qualifiedSports = Array.from(qualifiedSportsById.values()).sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.name.localeCompare(b.name, "fr");
  });
  const activeGroups = (coach.groups ?? []).map((group) => ({
    id: group.id,
    name: group.name,
    sportName: group.sport?.name ?? null,
    room: group.room,
  }));

  return {
    id: coach.id,
    firstName: coach.firstName,
    lastName: coach.lastName,
    phone: coach.phone,
    email: coach.email,
    isActive: coach.isActive,
    sportId: coach.sportId,
    sportName: coach.sport?.name ?? null,
    qualifiedSportIds: qualifiedSports.map((sport) => sport.id),
    qualifiedSports,
    activeGroups,
    activeGroupCount: activeGroups.length,
    weeklyScheduleCount: (coach.groups ?? []).reduce((sum, group) => sum + group.schedules.length, 0),
    createdAt: coach.createdAt.toISOString(),
    updatedAt: coach.updatedAt.toISOString(),
  };
}
