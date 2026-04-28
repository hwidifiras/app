export type DayOfWeekDto =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type GroupScheduleDto = {
  id: string;
  dayOfWeek: DayOfWeekDto;
  startTime: string;
  durationMinutes: number;
  effectiveFrom: string;
  effectiveTo: string | null;
};

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
  schedules: GroupScheduleDto[];
  createdAt: string;
  updatedAt: string;
};
