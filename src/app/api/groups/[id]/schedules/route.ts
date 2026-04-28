import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createGroupScheduleSchema, updateGroupScheduleSchema } from "@/lib/schemas/group";

export const runtime = "nodejs";

function toScheduleDto(schedule: {
  id: string;
  groupId: string;
  dayOfWeek: string;
  startTime: string;
  durationMinutes: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: schedule.id,
    groupId: schedule.groupId,
    dayOfWeek: schedule.dayOfWeek,
    startTime: schedule.startTime,
    durationMinutes: schedule.durationMinutes,
    effectiveFrom: schedule.effectiveFrom.toISOString(),
    effectiveTo: schedule.effectiveTo?.toISOString() ?? null,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const group = await prisma.group.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!group) {
    return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  }

  const schedules = await prisma.groupSchedule.findMany({
    where: { groupId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ data: schedules.map(toScheduleDto) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = createGroupScheduleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const group = await prisma.group.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!group) {
    return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  }

  const created = await prisma.groupSchedule.create({
    data: {
      groupId: id,
      dayOfWeek: parsed.data.dayOfWeek,
      startTime: parsed.data.startTime,
      durationMinutes: parsed.data.durationMinutes,
      effectiveFrom: parsed.data.effectiveFrom ? new Date(parsed.data.effectiveFrom) : new Date(),
      effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : null,
    },
  });

  return NextResponse.json({ data: toScheduleDto(created) }, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("scheduleId" in body)) {
    return NextResponse.json({ error: "scheduleId requis" }, { status: 400 });
  }

  const { scheduleId, ...payload } = body as { scheduleId: string };

  const parsed = updateGroupScheduleSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const group = await prisma.group.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!group) {
    return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  }

  const existing = await prisma.groupSchedule.findFirst({
    where: { id: scheduleId, groupId: id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Créneau introuvable" }, { status: 404 });
  }

  const updated = await prisma.groupSchedule.update({
    where: { id: scheduleId },
    data: {
      ...(parsed.data.dayOfWeek !== undefined ? { dayOfWeek: parsed.data.dayOfWeek } : {}),
      ...(parsed.data.startTime !== undefined ? { startTime: parsed.data.startTime } : {}),
      ...(parsed.data.durationMinutes !== undefined ? { durationMinutes: parsed.data.durationMinutes } : {}),
      ...(parsed.data.effectiveFrom !== undefined
        ? { effectiveFrom: new Date(parsed.data.effectiveFrom) }
        : {}),
      ...(parsed.data.effectiveTo === undefined
        ? {}
        : parsed.data.effectiveTo === null
          ? { effectiveTo: null }
          : { effectiveTo: new Date(parsed.data.effectiveTo) }),
    },
  });

  return NextResponse.json({ data: toScheduleDto(updated) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("scheduleId" in body)) {
    return NextResponse.json({ error: "scheduleId requis" }, { status: 400 });
  }

  const { scheduleId } = body as { scheduleId: string };

  const group = await prisma.group.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!group) {
    return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  }

  const existing = await prisma.groupSchedule.findFirst({
    where: { id: scheduleId, groupId: id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Créneau introuvable" }, { status: 404 });
  }

  await prisma.groupSchedule.delete({
    where: { id: scheduleId },
  });

  return NextResponse.json({ data: { deleted: true } });
}
