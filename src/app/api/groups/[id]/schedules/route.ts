import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createGroupScheduleSchema, updateGroupScheduleSchema } from "@/lib/schemas/group";
import { utcDateOnlyForTimeZone } from "@/lib/dates";
import { SessionStatus } from "@prisma/client";

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

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  const bodyObj = body as Record<string, unknown>;

  // Support both single schedule (legacy) and batch array
  const rawSchedules = Array.isArray(bodyObj.schedules)
    ? bodyObj.schedules
    : [bodyObj];

  if (rawSchedules.length === 0) {
    return NextResponse.json({ error: "Aucun créneau fourni" }, { status: 400 });
  }

  const parsedList = rawSchedules.map((item) => createGroupScheduleSchema.safeParse(item));
  const firstError = parsedList.find((p) => !p.success);

  if (firstError && !firstError.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: firstError.error.flatten(),
      },
      { status: 400 },
    );
  }

  const parsedData = parsedList.filter((p): p is typeof p & { success: true } => p.success).map((p) => p.data);

  const group = await prisma.group.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!group) {
    return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  }

  const created = await prisma.$transaction(
    parsedData.map((data) =>
      prisma.groupSchedule.create({
        data: {
          groupId: id,
          dayOfWeek: data.dayOfWeek,
          startTime: data.startTime,
          durationMinutes: data.durationMinutes,
          effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
          effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
        },
      })
    )
  );

  // Auto-generate sessions if requested
  let sessionResult: { createdCount: number; candidatesCount: number; skippedCount: number } | null = null;
  if (bodyObj.autoGenerate === true) {
    const horizonDays = typeof bodyObj.horizonDays === "number" && bodyObj.horizonDays > 0
      ? bodyObj.horizonDays
      : 90;

    sessionResult = await generateSessionsForGroup(id, created, horizonDays);
  }

  return NextResponse.json(
    {
      data: created.map(toScheduleDto),
      sessions: sessionResult,
    },
    { status: 201 }
  );
}

async function generateSessionsForGroup(
  groupId: string,
  schedules: { id: string; dayOfWeek: string; startTime: string; durationMinutes: number; effectiveFrom: Date; effectiveTo: Date | null }[],
  horizonDays: number
) {
  const today = utcDateOnlyForTimeZone(new Date());
  const endDate = new Date(today);
  endDate.setUTCDate(endDate.getUTCDate() + horizonDays);

  const dayMap = new Map<number, string>([
    [0, "SUNDAY"],
    [1, "MONDAY"],
    [2, "TUESDAY"],
    [3, "WEDNESDAY"],
    [4, "THURSDAY"],
    [5, "FRIDAY"],
    [6, "SATURDAY"],
  ]);

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { coachId: true, room: true },
  });

  const coachId = group?.coachId ?? null;
  const room = group?.room ?? "";

  const candidates: {
    groupId: string;
    scheduleId: string;
    sessionDate: Date;
    startTime: string;
    endTime: string;
    room: string;
    coachId: string | null;
    status: SessionStatus;
  }[] = [];

  for (let d = new Date(today); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    const weekday = dayMap.get(d.getUTCDay());
    const applicable = schedules.filter((s) => {
      const effectiveFrom = utcDateOnlyForTimeZone(s.effectiveFrom);
      const effectiveTo = s.effectiveTo ? utcDateOnlyForTimeZone(s.effectiveTo) : null;
      return (
        s.dayOfWeek === weekday &&
        d >= effectiveFrom &&
        (!effectiveTo || d <= effectiveTo)
      );
    });

    for (const schedule of applicable) {
      const [h, m] = schedule.startTime.split(":").map(Number);
      const startDate = new Date(d);
      startDate.setHours(h, m, 0, 0);
      const endDateObj = new Date(startDate);
      endDateObj.setMinutes(endDateObj.getMinutes() + schedule.durationMinutes);
      const endTime = `${String(endDateObj.getHours()).padStart(2, "0")}:${String(endDateObj.getMinutes()).padStart(2, "0")}`;

      candidates.push({
        groupId,
        scheduleId: schedule.id,
        sessionDate: new Date(d),
        startTime: schedule.startTime,
        endTime,
        room,
        coachId,
        status: "PLANNED",
      });
    }
  }

  if (candidates.length === 0) {
    return { createdCount: 0, candidatesCount: 0, skippedCount: 0 };
  }

  // Deduplicate against existing sessions
  const existing = await prisma.session.findMany({
    where: {
      groupId,
      sessionDate: {
        gte: today,
        lte: endDate,
      },
    },
    select: { sessionDate: true, startTime: true },
  });

  const existingSet = new Set(
    existing.map((e) => `${e.sessionDate.toISOString()}|${e.startTime}`)
  );

  const toCreate = candidates.filter(
    (c) => !existingSet.has(`${c.sessionDate.toISOString()}|${c.startTime}`)
  );

  if (toCreate.length > 0) {
    await prisma.session.createMany({
      data: toCreate.map((c) => ({
        groupId: c.groupId,
        scheduleId: c.scheduleId,
        sessionDate: c.sessionDate,
        startTime: c.startTime,
        endTime: c.endTime,
        room: c.room ?? "",
        coachId: c.coachId ?? undefined,
        status: c.status,
      })),
    });
  }

  return {
    createdCount: toCreate.length,
    candidatesCount: candidates.length,
    skippedCount: candidates.length - toCreate.length,
  };
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
