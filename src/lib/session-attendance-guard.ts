import { prisma } from "@/lib/prisma";

export const SESSION_HAS_ATTENDANCES_ERROR =
  "Impossible de modifier une séance avec des pointages enregistrés. Annulez les présences depuis le pointage du jour.";

export async function getSessionAttendanceCount(sessionId: string, tenantId?: string | null): Promise<number> {
  return prisma.attendance.count({ where: { ...(tenantId ? { tenantId } : {}), sessionId } });
}

export async function assertNoAttendancesForSessionEdit(
  sessionId: string,
  tenantId?: string | null,
): Promise<void> {
  const count = await getSessionAttendanceCount(sessionId, tenantId);
  if (count > 0) {
    throw new SessionEditBlockedError(SESSION_HAS_ATTENDANCES_ERROR);
  }
}

export async function assertNoAttendancesForSessionIds(
  sessionIds: string[],
  tenantId?: string | null,
): Promise<void> {
  if (sessionIds.length === 0) return;

  const count = await prisma.attendance.count({
    where: { ...(tenantId ? { tenantId } : {}), sessionId: { in: sessionIds } },
  });

  if (count > 0) {
    throw new SessionEditBlockedError(SESSION_HAS_ATTENDANCES_ERROR);
  }
}

export class SessionEditBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionEditBlockedError";
  }
}
