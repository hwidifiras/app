import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import {
  deriveSessionLifecycle,
  expectedMemberIdsAtSession,
} from "@/lib/session-lifecycle";

export const runtime = "nodejs";

const actionSchema = z.object({
  action: z.enum(["finalize", "reopen"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let actor;
  try {
    actor = await requirePermission(request, "attendance.manage");
  } catch (error) {
    return jsonAuthFailureResponse(error);
  }

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  }

  const { id } = await params;
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      group: {
        select: {
          members: {
            select: { memberId: true, startDate: true, endDate: true },
          },
        },
      },
      attendances: { select: { memberId: true } },
    },
  });
  if (!session) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }

  if (parsed.data.action === "reopen") {
    if (session.status !== "COMPLETED") {
      return NextResponse.json({ error: "Cette séance n'est pas finalisée" }, { status: 409 });
    }
    const completionLog = await prisma.auditLog.findFirst({
      where: {
        action: "SESSION_COMPLETED",
        entityType: "Session",
        entityId: id,
      },
      orderBy: { createdAt: "desc" },
      select: { details: true },
    });
    let reopenedStatus: "PLANNED" | "RESCHEDULED" = "PLANNED";
    try {
      const details = JSON.parse(completionLog?.details ?? "{}") as {
        previousStatus?: string;
      };
      if (details.previousStatus === "RESCHEDULED") reopenedStatus = "RESCHEDULED";
    } catch {
      // Older completion logs did not store the previous status.
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.session.update({
        where: { id },
        data: { status: reopenedStatus },
      });
      await tx.auditLog.create({
        data: {
          action: "SESSION_REOPENED",
          entityType: "Session",
          entityId: id,
          userId: actor.id,
          details: JSON.stringify({ previousStatus: "COMPLETED", reopenedStatus }),
        },
      });
      return next;
    });
    return NextResponse.json({ data: { id: updated.id, status: updated.status } });
  }

  if (session.status === "CANCELLED") {
    return NextResponse.json({ error: "Une séance annulée ne peut pas être finalisée" }, { status: 409 });
  }
  if (session.status === "COMPLETED") {
    return NextResponse.json({ data: { id: session.id, status: session.status } });
  }

  const lifecycle = deriveSessionLifecycle({
    status: session.status,
    sessionDate: session.sessionDate,
    endTime: session.endTime,
    expectedMemberIds: expectedMemberIdsAtSession(session.group.members, session.sessionDate),
    attendanceMemberIds: session.attendances.map((attendance) => attendance.memberId),
  });

  if (!lifecycle.ended) {
    return NextResponse.json(
      { error: "La séance ne peut être finalisée qu'après son heure de fin" },
      { status: 409 },
    );
  }
  if (!lifecycle.canFinalize) {
    return NextResponse.json(
      {
        error: `${lifecycle.unmarkedCount} membre${lifecycle.unmarkedCount > 1 ? "s" : ""} reste${lifecycle.unmarkedCount > 1 ? "nt" : ""} à pointer`,
        code: "SESSION_ATTENDANCE_INCOMPLETE",
        unmarkedCount: lifecycle.unmarkedCount,
      },
      { status: 409 },
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.session.update({
      where: { id },
      data: { status: "COMPLETED" },
    });
    await tx.auditLog.create({
      data: {
        action: "SESSION_COMPLETED",
        entityType: "Session",
        entityId: id,
        userId: actor.id,
        details: JSON.stringify({
          expectedMemberCount: lifecycle.expectedMemberCount,
          checkedMemberCount: lifecycle.checkedMemberCount,
          previousStatus: session.status,
        }),
      },
    });
    return next;
  });

  return NextResponse.json({ data: { id: updated.id, status: updated.status } });
}
