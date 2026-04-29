import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { bulkCreateGroupMembersSchema, bulkDeleteGroupMembersSchema } from "@/lib/schemas/group-member";

export const runtime = "nodejs";

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function intervalsOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
  return start1 < end2 && start2 < end1;
}

async function checkScheduleConflict(groupId: string, memberId: string) {
  const newGroupSchedules = await prisma.groupSchedule.findMany({
    where: { groupId },
    select: { dayOfWeek: true, startTime: true, durationMinutes: true },
  });

  if (newGroupSchedules.length === 0) return { ok: true as const };

  const now = new Date();
  const existingAssignments = await prisma.groupMember.findMany({
    where: {
      memberId,
      status: "ACTIVE",
      OR: [{ endDate: null }, { endDate: { gte: now } }],
      NOT: { groupId },
    },
    select: { groupId: true, group: { select: { name: true } } },
  });

  for (const assignment of existingAssignments) {
    const existingSchedules = await prisma.groupSchedule.findMany({
      where: { groupId: assignment.groupId },
      select: { dayOfWeek: true, startTime: true, durationMinutes: true },
    });

    for (const newSch of newGroupSchedules) {
      for (const exSch of existingSchedules) {
        if (newSch.dayOfWeek !== exSch.dayOfWeek) continue;

        const newStart = timeToMinutes(newSch.startTime);
        const newEnd = newStart + newSch.durationMinutes;
        const exStart = timeToMinutes(exSch.startTime);
        const exEnd = exStart + exSch.durationMinutes;

        if (intervalsOverlap(newStart, newEnd, exStart, exEnd)) {
          return {
            ok: false as const,
            error: `Conflit d'horaire : ce membre est déjà affecté au groupe "${assignment.group.name}" qui a une séance le ${exSch.dayOfWeek} à ${exSch.startTime} qui se chevauche avec ce groupe.`,
          };
        }
      }
    }
  }

  return { ok: true as const };
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = bulkCreateGroupMembersSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const uniqueMemberIds = Array.from(new Set(payload.memberIds));

  const group = await prisma.group.findUnique({
    where: { id: payload.groupId },
    select: { id: true, isActive: true, capacity: true },
  });

  if (!group) {
    return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  }

  if (!group.isActive) {
    return NextResponse.json({ error: "Impossible d'affecter un groupe inactif" }, { status: 409 });
  }

  const members = await prisma.member.findMany({
    where: { id: { in: uniqueMemberIds } },
    select: { id: true, status: true },
  });

  const membersMap = new Map(members.map((item) => [item.id, item]));

  const existingAssignments = await prisma.groupMember.findMany({
    where: {
      groupId: payload.groupId,
      memberId: { in: uniqueMemberIds },
    },
    select: { id: true, memberId: true, status: true },
  });

  const existingByMemberId = new Map(existingAssignments.map((item) => [item.memberId, item]));

  const activeCount = await prisma.groupMember.count({
    where: {
      groupId: payload.groupId,
      status: "ACTIVE",
    },
  });

  let availableSlots = Math.max(group.capacity - activeCount, 0);

  let createdCount = 0;
  let reactivatedCount = 0;
  let skippedNotFoundCount = 0;
  let skippedArchivedCount = 0;
  let skippedAlreadyActiveCount = 0;
  let skippedCapacityCount = 0;
  let skippedScheduleConflictCount = 0;

  for (const memberId of uniqueMemberIds) {
    const member = membersMap.get(memberId);
    if (!member) {
      skippedNotFoundCount += 1;
      continue;
    }

    if (member.status !== "ACTIVE") {
      skippedArchivedCount += 1;
      continue;
    }

    const existing = existingByMemberId.get(memberId);

    if (existing?.status === "ACTIVE") {
      skippedAlreadyActiveCount += 1;
      continue;
    }

    const scheduleCheck = await checkScheduleConflict(payload.groupId, memberId);
    if (!scheduleCheck.ok) {
      skippedScheduleConflictCount += 1;
      continue;
    }

    if (availableSlots <= 0) {
      skippedCapacityCount += 1;
      continue;
    }

    if (existing) {
      await prisma.groupMember.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          startDate: new Date(payload.startDate),
          endDate: payload.endDate ? new Date(payload.endDate) : null,
        },
      });
      reactivatedCount += 1;
      availableSlots -= 1;
      continue;
    }

    await prisma.groupMember.create({
      data: {
        groupId: payload.groupId,
        memberId,
        startDate: new Date(payload.startDate),
        endDate: payload.endDate ? new Date(payload.endDate) : null,
        status: "ACTIVE",
      },
    });
    createdCount += 1;
    availableSlots -= 1;
  }

  return NextResponse.json({
    data: {
      groupId: payload.groupId,
      requestedCount: uniqueMemberIds.length,
      createdCount,
      reactivatedCount,
      skippedNotFoundCount,
      skippedArchivedCount,
      skippedAlreadyActiveCount,
      skippedCapacityCount,
      skippedScheduleConflictCount,
    },
  });
}

export async function DELETE(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = bulkDeleteGroupMembersSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const uniqueMemberIds = Array.from(new Set(payload.memberIds));

  const deleted = await prisma.groupMember.deleteMany({
    where: {
      groupId: payload.groupId,
      memberId: { in: uniqueMemberIds },
    },
  });

  return NextResponse.json({
    data: {
      groupId: payload.groupId,
      requestedCount: uniqueMemberIds.length,
      deletedCount: deleted.count,
    },
  });
}
