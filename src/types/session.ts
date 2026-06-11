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
  postponedTo: string | null;
  postponementReason: string | null;
  postponementDetails: string | null;
  attendanceCount: number;
  createdAt: string;
  updatedAt: string;
};
