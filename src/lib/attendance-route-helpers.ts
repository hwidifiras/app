import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import type { AttendancePolicyFailure } from "@/lib/attendance-policy";

function getThirtyDaysAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function countAttendanceOverrides(memberId: string, tenantId: string): Promise<number> {
  const thirtyDaysAgo = getThirtyDaysAgo();
  return prisma.attendance.count({
    where: {
      tenantId,
      memberId,
      status: "OVERRIDE",
      checkedAt: { gte: thirtyDaysAgo },
    },
  });
}

export function attendancePolicyResponse(failure: AttendancePolicyFailure) {
  return NextResponse.json(failure.body, { status: failure.status });
}

export function readAttendanceIdFromBody(body: unknown):
  | { ok: true; attendanceId: string }
  | { ok: false; response: NextResponse } {
  if (typeof body !== "object" || body === null || !("attendanceId" in body)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "attendanceId requis" }, { status: 400 }),
    };
  }

  const attendanceId = (body as { attendanceId?: unknown }).attendanceId;

  if (typeof attendanceId !== "string" || attendanceId.trim().length === 0) {
    return {
      ok: false,
      response: NextResponse.json({ error: "attendanceId invalide" }, { status: 400 }),
    };
  }

  return { ok: true, attendanceId };
}

export function isPrismaErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === code
  );
}
