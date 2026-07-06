export type DayOfWeekValue =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type GroupAuditSource = {
  id: string;
  name: string;
  groupType: string;
  genderPolicy: string;
  sportId: string;
  coachId: string;
  capacity: number;
  room: string | null;
  isActive: boolean;
  sport?: { name: string } | null;
  coach?: { firstName: string; lastName: string } | null;
};

export function groupAuditSnapshot(group: GroupAuditSource) {
  return {
    id: group.id,
    name: group.name,
    groupType: group.groupType,
    genderPolicy: group.genderPolicy,
    sportId: group.sportId,
    sportName: group.sport?.name ?? null,
    coachId: group.coachId,
    coachName: group.coach ? `${group.coach.firstName} ${group.coach.lastName}` : null,
    capacity: group.capacity,
    room: group.room,
    isActive: group.isActive,
  };
}

export type GroupDtoSource = {
  id: string;
  name: string;
  groupType: "KIDS" | "ADULTS" | "MIXED";
  genderPolicy: "MALE_ONLY" | "FEMALE_ONLY" | "MIXED";
  sportId: string;
  coachId: string;
  capacity: number;
  room: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  sport: { name: string };
  coach: { firstName: string; lastName: string };
  schedules: {
    id: string;
    dayOfWeek: DayOfWeekValue;
    startTime: string;
    durationMinutes: number;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    createdAt: Date;
  }[];
  _count?: { members: number };
};

export function toGroupDto(group: GroupDtoSource) {
  return {
    id: group.id,
    name: group.name,
    activeMembers: group._count?.members ?? 0,
    groupType: group.groupType,
    genderPolicy: group.genderPolicy,
    sportId: group.sportId,
    sportName: group.sport.name,
    coachId: group.coachId,
    coachName: `${group.coach.firstName} ${group.coach.lastName}`,
    capacity: group.capacity,
    room: group.room,
    isActive: group.isActive,
    schedules: group.schedules.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      durationMinutes: s.durationMinutes,
      effectiveFrom: s.effectiveFrom.toISOString(),
      effectiveTo: s.effectiveTo?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    })),
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

export function readGroupIdFromBody(body: unknown) {
  if (typeof body !== "object" || body === null || !("groupId" in body)) {
    return { ok: false as const, error: "groupId requis" };
  }

  const groupId = (body as { groupId?: unknown }).groupId;

  if (typeof groupId !== "string" || groupId.trim().length === 0) {
    return { ok: false as const, error: "groupId invalide" };
  }

  return { ok: true as const, groupId };
}
