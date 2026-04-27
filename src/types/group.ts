export type DayOfWeekDto =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type GroupDto = {
  id: string;
  name: string;
  sportId: string;
  sportName: string;
  coachId: string;
  coachName: string;
  capacity: number;
  room: string;
  isActive: boolean;
  schedule: {
    dayOfWeek: DayOfWeekDto;
    startTime: string;
    durationMinutes: number;
    effectiveFrom: string;
    effectiveTo: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};
