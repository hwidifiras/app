type AttendanceAuditSnapshotInput = {
  id?: string;
  memberId: string;
  status: string;
  overrideReason: string | null;
  checkedBy: string | null;
  checkedAt: Date;
  memberSubscriptionId: string | null;
};

export function attendanceAuditSnapshot(attendance: AttendanceAuditSnapshotInput) {
  return {
    id: attendance.id ?? null,
    memberId: attendance.memberId,
    status: attendance.status,
    overrideReason: attendance.overrideReason,
    checkedBy: attendance.checkedBy,
    checkedAt: attendance.checkedAt.toISOString(),
    memberSubscriptionId: attendance.memberSubscriptionId,
  };
}

type AttendanceAuditSnapshot = ReturnType<typeof attendanceAuditSnapshot>;

export function attendanceCreatedAuditDetails(input: {
  tenantId: string;
  sessionId: string;
  memberId: string;
  status: string;
  sportId: string;
  overrideReason: string | null;
  subscriptionActive: boolean;
  overrideKind: string;
  remainingSessionsBefore: number | null;
}) {
  return {
    sessionId: input.sessionId,
    memberId: input.memberId,
    tenantId: input.tenantId,
    status: input.status,
    sportId: input.sportId,
    overrideReason: input.overrideReason,
    subscriptionActive: input.subscriptionActive,
    overrideKind: input.overrideKind,
    remainingSessionsBefore: input.remainingSessionsBefore,
  };
}

export function attendanceUpdatedAuditDetails(input: {
  tenantId: string;
  oldStatus: string;
  newStatus: string;
  overrideReason: string | null;
  sessionBalanceDelta: number;
  before: AttendanceAuditSnapshot;
  after: AttendanceAuditSnapshot;
}) {
  return {
    tenantId: input.tenantId,
    oldStatus: input.oldStatus,
    newStatus: input.newStatus,
    overrideReason: input.overrideReason,
    sessionBalanceDelta: input.sessionBalanceDelta,
    before: input.before,
    after: input.after,
  };
}

export function attendanceDeletedAuditDetails(input: {
  tenantId: string;
  deletedAt: Date;
  previousStatus: string;
  previous: {
    status: string;
    overrideReason: string | null;
    checkedBy: string | null;
    checkedAt: Date;
    memberSubscriptionId: string | null;
  };
  memberId: string;
  sessionId: string;
  memberSubscriptionId: string | null;
  sessionBalanceDelta: number;
}) {
  return {
    tenantId: input.tenantId,
    deletedAt: input.deletedAt.toISOString(),
    reason: "Annulation du pointage",
    previousStatus: input.previousStatus,
    previous: {
      status: input.previous.status,
      overrideReason: input.previous.overrideReason,
      checkedBy: input.previous.checkedBy,
      checkedAt: input.previous.checkedAt.toISOString(),
      memberSubscriptionId: input.previous.memberSubscriptionId,
    },
    memberId: input.memberId,
    sessionId: input.sessionId,
    memberSubscriptionId: input.memberSubscriptionId,
    sessionBalanceDelta: input.sessionBalanceDelta,
  };
}
