import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createAttendanceSchema, updateAttendanceSchema } from "@/lib/schemas/attendance";

export const runtime = "nodejs";

function getThirtyDaysAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function countOverrides(memberId: string): Promise<number> {
  const thirtyDaysAgo = getThirtyDaysAgo();
  return prisma.attendance.count({
    where: {
      memberId,
      status: "OVERRIDE",
      checkedAt: { gte: thirtyDaysAgo },
    },
  });
}

async function hasActiveSubscription(memberId: string): Promise<boolean> {
  const now = new Date();
  const active = await prisma.memberSubscription.findFirst({
    where: {
      memberId,
      status: "ACTIVE",
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
  });
  return !!active;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId")?.trim();
  const memberId = searchParams.get("memberId")?.trim();

  const attendances = await prisma.attendance.findMany({
    where: {
      ...(sessionId ? { sessionId } : {}),
      ...(memberId ? { memberId } : {}),
    },
    include: {
      session: {
        select: {
          id: true,
          sessionDate: true,
          startTime: true,
          group: { select: { id: true, name: true } },
        },
      },
      member: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { checkedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ data: attendances });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = createAttendanceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { sessionId, memberId, status, overrideReason, checkedBy } = parsed.data;

  try {
    const sessionExists = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!sessionExists) {
      return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
    }

    const memberExists = await prisma.member.findUnique({ where: { id: memberId } });
    if (!memberExists) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    if (memberExists.status === "ARCHIVED") {
      return NextResponse.json({ error: "Impossible de pointer un membre archivé" }, { status: 403 });
    }

    const isSubActive = await hasActiveSubscription(memberId);

    if (status === "PRESENT" || status === "ABSENT" || status === "EXCUSED") {
      if (!isSubActive) {
        return NextResponse.json(
          {
            error: "Abonnement inactif — passage exceptionnel requis",
            code: "SUBSCRIPTION_INACTIVE",
          },
          { status: 403 },
        );
      }
    }

    if (status === "OVERRIDE") {
      if (!overrideReason || overrideReason.trim().length === 0) {
        return NextResponse.json(
          { error: "Motif obligatoire pour un passage exceptionnel" },
          { status: 400 },
        );
      }

      const overrideCount = await countOverrides(memberId);

      if (overrideCount >= 3) {
        return NextResponse.json(
          {
            error: "Limite de passages exceptionnels atteinte (3/30j) — validation managériale requise",
            code: "OVERRIDE_LIMIT_REACHED",
            count: overrideCount,
          },
          { status: 403 },
        );
      }

      if (overrideCount >= 2) {
        // avertissement enregistré mais on laisse passer
        // le front affichera le warning
      }
    }

    const attendance = await prisma.attendance.create({
      data: {
        sessionId,
        memberId,
        status,
        overrideReason: overrideReason?.trim() || null,
        checkedBy: checkedBy?.trim() || null,
      },
      include: {
        session: {
          select: {
            id: true,
            sessionDate: true,
            startTime: true,
            group: { select: { id: true, name: true } },
          },
        },
        member: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "ATTENDANCE_CREATED",
        entityType: "Attendance",
        entityId: attendance.id,
        details: JSON.stringify({
          sessionId,
          memberId,
          status,
          overrideReason: overrideReason || null,
          subscriptionActive: isSubActive,
        }),
      },
    });

    return NextResponse.json(
      {
        data: attendance,
        warning:
          status === "OVERRIDE" && (await countOverrides(memberId)) >= 2
            ? "Attention: 2 passages exceptionnels sur 30 jours"
            : undefined,
      },
      { status: 201 },
    );
  } catch (error) {
    const isDuplicate =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

    if (isDuplicate) {
      return NextResponse.json(
        { error: "Présence déjà enregistrée pour ce membre sur cette séance" },
        { status: 409 },
      );
    }

    console.error("[POST /api/attendances] error:", error);
    return NextResponse.json({ error: "Erreur serveur lors de la création de la présence" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("attendanceId" in body)) {
    return NextResponse.json({ error: "attendanceId requis" }, { status: 400 });
  }

  const attendanceId = (body as { attendanceId?: unknown }).attendanceId;

  if (typeof attendanceId !== "string" || attendanceId.trim().length === 0) {
    return NextResponse.json({ error: "attendanceId invalide" }, { status: 400 });
  }

  const updatePayload = updateAttendanceSchema.safeParse((body as Record<string, unknown>).payload);

  if (!updatePayload.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: updatePayload.error.flatten(),
      },
      { status: 400 },
    );
  }

  const payload = updatePayload.data;

  try {
    const existing = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      select: { memberId: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Présence introuvable" }, { status: 404 });
    }

    if (payload.status === "OVERRIDE") {
      const overrideCount = await countOverrides(existing.memberId);
      if (overrideCount >= 3) {
        return NextResponse.json(
          {
            error: "Limite de passages exceptionnels atteinte (3/30j) — validation managériale requise",
            code: "OVERRIDE_LIMIT_REACHED",
            count: overrideCount,
          },
          { status: 403 },
        );
      }
    }

    const updated = await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        status: payload.status,
        overrideReason:
          payload.overrideReason === undefined
            ? undefined
            : payload.overrideReason === "" || payload.overrideReason === null
              ? null
              : payload.overrideReason,
        checkedBy:
          payload.checkedBy === undefined
            ? undefined
            : payload.checkedBy === "" || payload.checkedBy === null
              ? null
              : payload.checkedBy,
      },
      include: {
        session: {
          select: {
            id: true,
            sessionDate: true,
            startTime: true,
            group: { select: { id: true, name: true } },
          },
        },
        member: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "ATTENDANCE_UPDATED",
        entityType: "Attendance",
        entityId: attendanceId,
        details: JSON.stringify({
          oldStatus: existing.status,
          newStatus: payload.status,
          overrideReason: payload.overrideReason || null,
        }),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025";

    if (isNotFound) {
      return NextResponse.json({ error: "Présence introuvable" }, { status: 404 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de la modification" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("attendanceId" in body)) {
    return NextResponse.json({ error: "attendanceId requis" }, { status: 400 });
  }

  const attendanceId = (body as { attendanceId?: unknown }).attendanceId;

  if (typeof attendanceId !== "string" || attendanceId.trim().length === 0) {
    return NextResponse.json({ error: "attendanceId invalide" }, { status: 400 });
  }

  try {
    await prisma.attendance.delete({
      where: { id: attendanceId },
    });

    await prisma.auditLog.create({
      data: {
        action: "ATTENDANCE_DELETED",
        entityType: "Attendance",
        entityId: attendanceId,
        details: JSON.stringify({ deletedAt: new Date().toISOString() }),
      },
    });

    return NextResponse.json({ data: { id: attendanceId } });
  } catch (error) {
    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025";

    if (isNotFound) {
      return NextResponse.json({ error: "Présence introuvable" }, { status: 404 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de la suppression" }, { status: 500 });
  }
}
