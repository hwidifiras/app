export type SessionStatusDto = "PLANNED" | "RESCHEDULED" | "CANCELLED" | "COMPLETED";

export type SessionDto = {
  id: string;
  groupId: string;
  groupName: string;
  scheduleId: string | null;
  sessionDate: string;
  startTime: string;
  endTime: string;
  coachId: string | null;
  coachName: string | null;
  room: string;
  status: SessionStatusDto;
  exceptionReason: string | null;
  createdAt: string;
  updatedAt: string;
};
