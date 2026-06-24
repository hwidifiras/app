export type SessionStatusDto = "PLANNED" | "RESCHEDULED" | "CANCELLED" | "COMPLETED";
export type SessionOperationalStatusDto =
  | "UPCOMING"
  | "NEEDS_FINALIZATION"
  | "COMPLETED"
  | "CANCELLED";

export type SessionDto = {
  id: string;
  groupId: string;
  groupName: string;
  groupSportId?: string;
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
  operationalStatus?: SessionOperationalStatusDto;
  expectedMemberCount?: number;
  unmarkedCount?: number;
  canFinalize?: boolean;
  createdAt: string;
  updatedAt: string;
};
