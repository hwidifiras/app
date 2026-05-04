import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { utcDateOnlyForTimeZone } from "@/lib/dates";
import { generateSessionsSchema } from "@/lib/schemas/session";

export const runtime = "nodejs";

type DayOfWeekValue = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

const dayToIndex: Record<DayOfWeekValue, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

function toUtcDateOnly(date: Date) {
  return utcDateOnlyForTimeZone(date);
}

function addMinutesToTime(startTime: string, durationMinutes: number) {
  const [hours, minutes] = startTime.split(":").map((value) => Number(value));
  const total = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor((total % (24 * 60)) / 60);
  const endMinutes = total % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

function toSessionDto(session: {
  id: string;
  groupId: string;
  scheduleId: string | null;
  sessionDate: Date;
  startTime: string;
  endTime: string;
  coachId: string | null;
  room: string;
  status: "PLANNED" | "RESCHEDULED" | "CANCELLED" | "COMPLETED";
  exceptionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  group: { name: string };
  coach: { firstName: string; lastName: string } | null;
}) {
  return {
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
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId")?.trim();
  const from = searchParams.get("from")?.trim();
  const to = searchParams.get("to")?.trim();

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  const sessions = await prisma.session.findMany({
    where: {
      ...(groupId ? { groupId } : {}),
      ...(fromDate || toDate
        ? {
            sessionDate: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
    include: {
      group: { select: { name: true } },
      coach: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
    take: 200,
  });

  return NextResponse.json({ data: sessions.map(toSessionDto) });
}

export async function POST(request: Request) {
  let body: unknown = {};

  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = generateSessionsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const horizonDays = parsed.data.horizonDays ?? 56;
  const bodyGroupId = typeof body === "object" && body !== null && "groupId" in body ? (body as { groupId?: string }).groupId : undefined;

  const startDate = toUtcDateOnly(new Date());
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + horizonDays);

  const groups = await prisma.group.findMany({
    where: {
      isActive: true,
      ...(bodyGroupId ? { id: bodyGroupId } : {}),
    },
    include: {
      schedules: {
        where: {
          effectiveFrom: { lte: endDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: startDate } }],
        },
      },
    },
  });

  const candidates: Array<{
    groupId: string;
    scheduleId: string;
    sessionDate: Date;
    startTime: string;
    endTime: string;
    coachId: string;
    room: string;
    status: "PLANNED";
  }> = [];

  for (const group of groups) {
    for (const schedule of group.schedules) {
      const effectiveFrom = toUtcDateOnly(schedule.effectiveFrom);
      const effectiveTo = schedule.effectiveTo ? toUtcDateOnly(schedule.effectiveTo) : null;

      for (let cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const dayMatch = cursor.getUTCDay() === dayToIndex[schedule.dayOfWeek as DayOfWeekValue];
        if (!dayMatch) {
          continue;
        }

        const cursorDate = cursor;

        if (cursorDate < effectiveFrom) {
          continue;
        }

        if (effectiveTo && cursorDate > effectiveTo) {
          continue;
        }

        candidates.push({
          groupId: group.id,
          scheduleId: schedule.id,
          sessionDate: toUtcDateOnly(cursorDate),
          startTime: schedule.startTime,
          endTime: addMinutesToTime(schedule.startTime, schedule.durationMinutes),
          coachId: group.coachId,
          room: group.room,
          status: "PLANNED",
        });
      }
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({
      data: {
        horizonDays,
        candidatesCount: 0,
        createdCount: 0,
        skippedCount: 0,
      },
    });
  }

  const uniqueCandidatesMap = new Map<string, (typeof candidates)[number]>();
  for (const candidate of candidates) {
    const key = `${candidate.groupId}|${candidate.sessionDate.toISOString()}|${candidate.startTime}`;
    if (!uniqueCandidatesMap.has(key)) {
      uniqueCandidatesMap.set(key, candidate);
    }
  }

  const uniqueCandidates = Array.from(uniqueCandidatesMap.values());

  const existingSessions = await prisma.session.findMany({
    where: {
      groupId: { in: Array.from(new Set(uniqueCandidates.map((item) => item.groupId))) },
      sessionDate: {
        gte: toUtcDateOnly(startDate),
        lte: toUtcDateOnly(endDate),
      },
    },
    select: {
      groupId: true,
      sessionDate: true,
      startTime: true,
    },
  });

  const existingKeys = new Set(
    existingSessions.map((session) => `${session.groupId}|${session.sessionDate.toISOString()}|${session.startTime}`),
  );

  const toCreate = uniqueCandidates.filter((candidate) => {
    const key = `${candidate.groupId}|${candidate.sessionDate.toISOString()}|${candidate.startTime}`;
    return !existingKeys.has(key);
  });

  if (toCreate.length === 0) {
    return NextResponse.json({
      data: {
        horizonDays,
        candidatesCount: uniqueCandidates.length,
        createdCount: 0,
        skippedCount: uniqueCandidates.length,
      },
    });
  }

  const result = await prisma.session.createMany({
    data: toCreate,
  });

  return NextResponse.json({
    data: {
      horizonDays,
      candidatesCount: uniqueCandidates.length,
      createdCount: result.count,
      skippedCount: uniqueCandidates.length - result.count,
    },
  });
}
