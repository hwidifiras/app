import { prisma } from "@/lib/prisma";
import {
  enrollmentUndoSnapshotSchema,
  getEnrollmentRevertBlockReason,
  type EnrollmentUndoSnapshot,
} from "@/lib/enrollment-undo";

export type EnrollmentRecoveryCandidate = {
  auditLogId: string;
  recoveryKey: string;
  createdAt: string;
  memberIds: string[];
  subscriptionIds: string[];
  summary: string;
  totalFinalCents: number | null;
  blockedReason: string | null;
  alreadyVoided: boolean;
};

type EnrollmentRecoveryDetails = {
  recoveryKey: string;
  undoSnapshot: EnrollmentUndoSnapshot;
  memberIds: string[];
  subscriptionIds: string[];
  totalFinalCents: number | null;
  summary: string;
};

export function parseEnrollmentRecoveryDetails(details: string | null): EnrollmentRecoveryDetails | null {
  if (!details) return null;
  try {
    const parsed = JSON.parse(details) as {
      recoveryKey?: unknown;
      undoSnapshot?: unknown;
      memberIds?: unknown;
      subscriptionIds?: unknown;
      totalFinalCents?: unknown;
      lines?: unknown;
    };
    const recoveryKey = typeof parsed.recoveryKey === "string" ? parsed.recoveryKey : "";
    const snapshot = enrollmentUndoSnapshotSchema.safeParse(parsed.undoSnapshot);
    if (!recoveryKey || !snapshot.success) return null;

    const memberIds = Array.isArray(parsed.memberIds)
      ? parsed.memberIds.filter((item): item is string => typeof item === "string")
      : [];
    const subscriptionIds = Array.isArray(parsed.subscriptionIds)
      ? parsed.subscriptionIds.filter((item): item is string => typeof item === "string")
      : [];
    const lineNames = Array.isArray(parsed.lines)
      ? parsed.lines
          .map((item) => {
            if (!item || typeof item !== "object" || !("memberName" in item)) return null;
            const memberName = (item as { memberName?: unknown }).memberName;
            return typeof memberName === "string" && memberName.trim() ? memberName.trim() : null;
          })
          .filter((item): item is string => Boolean(item))
      : [];

    return {
      recoveryKey,
      undoSnapshot: snapshot.data,
      memberIds,
      subscriptionIds,
      totalFinalCents: typeof parsed.totalFinalCents === "number" ? parsed.totalFinalCents : null,
      summary: lineNames.length > 0 ? lineNames.join(", ") : `${subscriptionIds.length} abonnement(s)`,
    };
  } catch {
    return null;
  }
}

export async function getEnrollmentRecoveryByKey(recoveryKey: string, tenantId?: string | null) {
  const log = await prisma.auditLog.findFirst({
    where: {
      tenantId: tenantId ?? undefined,
      action: "ENROLLMENT_APPLIED",
      entityType: "Enrollment",
      details: { contains: recoveryKey },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!log) return null;
  const details = parseEnrollmentRecoveryDetails(log.details);
  if (!details || details.recoveryKey !== recoveryKey) return null;

  return {
    auditLogId: log.id,
    createdAt: log.createdAt,
    ...details,
  };
}

export async function isEnrollmentRecoveryVoided(recoveryKey: string, tenantId?: string | null) {
  const existingVoid = await prisma.auditLog.findFirst({
    where: {
      tenantId: tenantId ?? undefined,
      action: "ENROLLMENT_VOIDED",
      entityType: "Enrollment",
      details: { contains: recoveryKey },
    },
    select: { id: true },
  });
  return Boolean(existingVoid);
}

export async function getEnrollmentRecoveryCandidatesForMember(
  memberId: string,
  tenantId?: string | null,
): Promise<EnrollmentRecoveryCandidate[]> {
  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId: tenantId ?? undefined,
      action: "ENROLLMENT_APPLIED",
      entityType: "Enrollment",
      details: { contains: memberId },
    },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const candidates: EnrollmentRecoveryCandidate[] = [];

  for (const log of logs) {
    const details = parseEnrollmentRecoveryDetails(log.details);
    if (!details || !details.memberIds.includes(memberId)) continue;

    const alreadyVoided = await isEnrollmentRecoveryVoided(details.recoveryKey, tenantId);
    const blockedReason = alreadyVoided
      ? "Inscription déjà annulée avec trace."
      : await prisma.$transaction((tx) => getEnrollmentRevertBlockReason(tx, details.undoSnapshot, tenantId));

    candidates.push({
      auditLogId: log.id,
      recoveryKey: details.recoveryKey,
      createdAt: log.createdAt.toISOString(),
      memberIds: details.memberIds,
      subscriptionIds: details.subscriptionIds,
      summary: details.summary,
      totalFinalCents: details.totalFinalCents,
      blockedReason,
      alreadyVoided,
    });
  }

  return candidates;
}
