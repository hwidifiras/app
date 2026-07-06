import { Prisma } from "@prisma/client";

export function addMinutesToTime(startTime: string, durationMinutes: number) {
  const [hours, minutes] = startTime.split(":").map((value) => Number(value));
  const total = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor((total % (24 * 60)) / 60);
  const endMinutes = total % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

export type SessionResponseSource = {
  id: string;
  groupId: string;
  scheduleId: string | null;
  sessionDate: Date;
  startTime: string;
  endTime: string;
  coachId: string | null;
  room: string;
  status: string;
  exceptionReason: string | null;
  postponedTo: Date | null;
  postponementReason: string | null;
  postponementDetails: string | null;
  createdAt: Date;
  updatedAt: Date;
  group: { name: string; sportId: string };
  coach: { firstName: string; lastName: string } | null;
};

export function sessionResponsePayload(updated: SessionResponseSource) {
  return {
    id: updated.id,
    groupId: updated.groupId,
    groupName: updated.group.name,
    groupSportId: updated.group.sportId,
    scheduleId: updated.scheduleId,
    sessionDate: updated.sessionDate.toISOString(),
    startTime: updated.startTime,
    endTime: updated.endTime,
    coachId: updated.coachId,
    coachName: updated.coach ? `${updated.coach.firstName} ${updated.coach.lastName}` : null,
    room: updated.room,
    status: updated.status,
    exceptionReason: updated.exceptionReason,
    postponedTo: updated.postponedTo ? updated.postponedTo.toISOString() : null,
    postponementReason: updated.postponementReason,
    postponementDetails: updated.postponementDetails,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export type SessionAuditSnapshotInput = {
  id: string;
  groupId: string;
  scheduleId: string | null;
  sessionDate: Date;
  startTime: string;
  endTime: string;
  coachId: string | null;
  room: string;
  status: string;
  exceptionReason: string | null;
  postponedTo?: Date | null;
  postponementReason?: string | null;
  postponementDetails?: string | null;
};

export function sessionAuditSnapshot(session: SessionAuditSnapshotInput) {
  return {
    id: session.id,
    groupId: session.groupId,
    scheduleId: session.scheduleId,
    sessionDate: session.sessionDate.toISOString(),
    startTime: session.startTime,
    endTime: session.endTime,
    coachId: session.coachId,
    room: session.room,
    status: session.status,
    exceptionReason: session.exceptionReason,
    postponedTo: session.postponedTo ? session.postponedTo.toISOString() : null,
    postponementReason: session.postponementReason ?? null,
    postponementDetails: session.postponementDetails ?? null,
  };
}

export type SessionAuditSnapshot = ReturnType<typeof sessionAuditSnapshot>;

export function changedSessionFields(before: SessionAuditSnapshot, after: SessionAuditSnapshot) {
  return Object.keys(after).filter((key) => {
    if (key === "id" || key === "groupId" || key === "scheduleId") return false;
    return before[key as keyof SessionAuditSnapshot] !== after[key as keyof SessionAuditSnapshot];
  });
}

export function isPrismaErrorCode(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
