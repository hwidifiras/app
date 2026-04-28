import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { updateSessionSchema } from "@/lib/schemas/session";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      group: { select: { name: true } },
      coach: { select: { firstName: true, lastName: true } },
      schedule: {
        select: {
          dayOfWeek: true,
          durationMinutes: true,
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }

  return NextResponse.json({
    data: {
      id: session.id,
      groupId: session.groupId,
      groupName: session.group.name,
      scheduleId: session.scheduleId,
      sessionDate: session.sessionDate.toISOString(),
      startTime: session.startTime,
      endTime: session.endTime,
      coachId: session.coachId,
      coachName: session.coach ? `${session.coach.firstName} ${session.coach.lastName}` : null,
      room: session.room,
      status: session.status,
      exceptionReason: session.exceptionReason,
      schedule: session.schedule,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = updateSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const existing = await prisma.session.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }

  const payload = parsed.data;

  const updated = await prisma.session.update({
    where: { id },
    data: {
      ...(payload.coachId !== undefined ? { coachId: payload.coachId } : {}),
      ...(payload.room !== undefined ? { room: payload.room } : {}),
      ...(payload.startTime !== undefined ? { startTime: payload.startTime } : {}),
      ...(payload.endTime !== undefined ? { endTime: payload.endTime } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.exceptionReason !== undefined ? { exceptionReason: payload.exceptionReason } : {}),
    },
    include: {
      group: { select: { name: true } },
      coach: { select: { firstName: true, lastName: true } },
    },
  });

  return NextResponse.json({
    data: {
      id: updated.id,
      groupId: updated.groupId,
      groupName: updated.group.name,
      scheduleId: updated.scheduleId,
      sessionDate: updated.sessionDate.toISOString(),
      startTime: updated.startTime,
      endTime: updated.endTime,
      coachId: updated.coachId,
      coachName: updated.coach ? `${updated.coach.firstName} ${updated.coach.lastName}` : null,
      room: updated.room,
      status: updated.status,
      exceptionReason: updated.exceptionReason,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const existing = await prisma.session.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }

  await prisma.session.delete({
    where: { id },
  });

  return NextResponse.json({ data: { deleted: true } });
}
