import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createGroupSchema, updateGroupSchema } from "@/lib/schemas/group";

export const runtime = "nodejs";

type DayOfWeekValue =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

function toGroupDto(group: {
  id: string;
  name: string;
  sportId: string;
  coachId: string;
  capacity: number;
  room: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  sport: { name: string };
  coach: { firstName: string; lastName: string };
  schedules: {
    dayOfWeek: DayOfWeekValue;
    startTime: string;
    durationMinutes: number;
    effectiveFrom: Date;
    effectiveTo: Date | null;
  }[];
}) {
  const firstSchedule = group.schedules[0] ?? null;

  return {
    id: group.id,
    name: group.name,
    sportId: group.sportId,
    sportName: group.sport.name,
    coachId: group.coachId,
    coachName: `${group.coach.firstName} ${group.coach.lastName}`,
    capacity: group.capacity,
    room: group.room,
    isActive: group.isActive,
    schedule: firstSchedule
      ? {
          dayOfWeek: firstSchedule.dayOfWeek,
          startTime: firstSchedule.startTime,
          durationMinutes: firstSchedule.durationMinutes,
          effectiveFrom: firstSchedule.effectiveFrom.toISOString(),
          effectiveTo: firstSchedule.effectiveTo?.toISOString() ?? null,
        }
      : null,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  const groups = await prisma.group.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query } },
            { room: { contains: query } },
            { sport: { is: { name: { contains: query } } } },
            { coach: { is: { firstName: { contains: query } } } },
            { coach: { is: { lastName: { contains: query } } } },
          ],
        }
      : undefined,
    include: {
      sport: { select: { name: true } },
      coach: { select: { firstName: true, lastName: true } },
      schedules: { orderBy: { createdAt: "asc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ data: groups.map(toGroupDto) });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = createGroupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const sportExists = await prisma.sport.findUnique({ where: { id: parsed.data.sportId }, select: { id: true } });
  if (!sportExists) {
    return NextResponse.json({ error: "Sport introuvable" }, { status: 404 });
  }

  const coachExists = await prisma.coach.findUnique({ where: { id: parsed.data.coachId }, select: { id: true } });
  if (!coachExists) {
    return NextResponse.json({ error: "Coach introuvable" }, { status: 404 });
  }

  const created = await prisma.group.create({
    data: {
      name: parsed.data.name,
      sportId: parsed.data.sportId,
      coachId: parsed.data.coachId,
      capacity: parsed.data.capacity,
      room: parsed.data.room,
      schedules: {
        create: {
          dayOfWeek: parsed.data.schedule.dayOfWeek,
          startTime: parsed.data.schedule.startTime,
          durationMinutes: parsed.data.schedule.durationMinutes,
          effectiveFrom: parsed.data.schedule.effectiveFrom ? new Date(parsed.data.schedule.effectiveFrom) : new Date(),
          effectiveTo: parsed.data.schedule.effectiveTo ? new Date(parsed.data.schedule.effectiveTo) : null,
        },
      },
    },
    include: {
      sport: { select: { name: true } },
      coach: { select: { firstName: true, lastName: true } },
      schedules: { orderBy: { createdAt: "asc" }, take: 1 },
    },
  });

  return NextResponse.json({ data: toGroupDto(created) }, { status: 201 });
}

export async function PATCH(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("groupId" in body)) {
    return NextResponse.json({ error: "groupId requis" }, { status: 400 });
  }

  const groupId = (body as { groupId?: unknown }).groupId;

  if (typeof groupId !== "string" || groupId.trim().length === 0) {
    return NextResponse.json({ error: "groupId invalide" }, { status: 400 });
  }

  const updatePayload = updateGroupSchema.safeParse((body as Record<string, unknown>).payload);

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

  if (payload.sportId) {
    const sportExists = await prisma.sport.findUnique({ where: { id: payload.sportId }, select: { id: true } });
    if (!sportExists) {
      return NextResponse.json({ error: "Sport introuvable" }, { status: 404 });
    }
  }

  if (payload.coachId) {
    const coachExists = await prisma.coach.findUnique({ where: { id: payload.coachId }, select: { id: true } });
    if (!coachExists) {
      return NextResponse.json({ error: "Coach introuvable" }, { status: 404 });
    }
  }

  try {
    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: {
        name: payload.name,
        sportId: payload.sportId,
        coachId: payload.coachId,
        capacity: payload.capacity,
        room: payload.room,
        isActive: payload.isActive,
      },
      include: {
        sport: { select: { name: true } },
        coach: { select: { firstName: true, lastName: true } },
        schedules: { orderBy: { createdAt: "asc" }, take: 1 },
      },
    });

    if (payload.schedule) {
      const firstSchedule = updatedGroup.schedules[0];

      if (firstSchedule) {
        await prisma.groupSchedule.update({
          where: { id: firstSchedule.id },
          data: {
            dayOfWeek: payload.schedule.dayOfWeek,
            startTime: payload.schedule.startTime,
            durationMinutes: payload.schedule.durationMinutes,
            effectiveFrom: payload.schedule.effectiveFrom ? new Date(payload.schedule.effectiveFrom) : undefined,
            effectiveTo:
              payload.schedule.effectiveTo === undefined
                ? undefined
                : payload.schedule.effectiveTo === null
                  ? null
                  : new Date(payload.schedule.effectiveTo),
          },
        });
      } else {
        await prisma.groupSchedule.create({
          data: {
            groupId,
            dayOfWeek: payload.schedule.dayOfWeek,
            startTime: payload.schedule.startTime,
            durationMinutes: payload.schedule.durationMinutes,
            effectiveFrom: payload.schedule.effectiveFrom ? new Date(payload.schedule.effectiveFrom) : new Date(),
            effectiveTo: payload.schedule.effectiveTo ? new Date(payload.schedule.effectiveTo) : null,
          },
        });
      }
    }

    const refreshed = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        sport: { select: { name: true } },
        coach: { select: { firstName: true, lastName: true } },
        schedules: { orderBy: { createdAt: "asc" }, take: 1 },
      },
    });

    if (!refreshed) {
      return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
    }

    return NextResponse.json({ data: toGroupDto(refreshed) });
  } catch {
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

  if (typeof body !== "object" || body === null || !("groupId" in body)) {
    return NextResponse.json({ error: "groupId requis" }, { status: 400 });
  }

  const groupId = (body as { groupId?: unknown }).groupId;

  if (typeof groupId !== "string" || groupId.trim().length === 0) {
    return NextResponse.json({ error: "groupId invalide" }, { status: 400 });
  }

  try {
    await prisma.group.delete({ where: { id: groupId } });
    return NextResponse.json({ data: { id: groupId } });
  } catch {
    return NextResponse.json({ error: "Erreur serveur lors de la suppression" }, { status: 500 });
  }
}
