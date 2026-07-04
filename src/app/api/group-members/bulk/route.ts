import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { bulkCreateGroupMembersSchema, bulkDeleteGroupMembersSchema } from "@/lib/schemas/group-member";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { activeAssignmentWindow, checkScheduleConflictForAssignmentWindow } from "@/lib/assignment-policy";

export const runtime = "nodejs";

function isMemberAllowed(groupType: "KIDS" | "ADULTS", memberType: "KID" | "ADULT" | "NOT_SPECIFIED") {
  if (groupType === "KIDS") {
    return memberType === "KID" || memberType === "NOT_SPECIFIED";
  }
  return memberType === "ADULT" || memberType === "NOT_SPECIFIED";
}

export async function POST(request: Request) {
  try {
    await requirePermission(request, "enrollment.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

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
  const assignmentStartDate = new Date(payload.startDate);

  const group = await prisma.group.findUnique({
    where: { id: payload.groupId },
    select: { id: true, isActive: true, capacity: true, groupType: true, sportId: true },
  });

  if (!group) {
    return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  }

  if (!group.isActive) {
    return NextResponse.json({ error: "Impossible d'affecter un groupe inactif" }, { status: 409 });
  }

  const members = await prisma.member.findMany({
    where: { id: { in: uniqueMemberIds } },
    select: { id: true, status: true, memberType: true },
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
      ...activeAssignmentWindow(assignmentStartDate),
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
  let skippedTypeMismatchCount = 0;
  let skippedNoSubscriptionCount = 0;
  let skippedUnpaidSubscriptionCount = 0;
  let skippedSportMismatchCount = 0;

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

    if (!isMemberAllowed(group.groupType, member.memberType)) {
      skippedTypeMismatchCount += 1;
      continue;
    }

    const now = new Date();
    const activeSub = await prisma.memberSubscription.findFirst({
      where: {
        memberId,
        sportId: group.sportId,
        status: "ACTIVE",
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
        remainingSessions: { gt: 0 },
      },
      select: {
        amount: true,
        payments: { select: { amount: true } },
        plan: { select: { sportId: true } },
      },
      orderBy: { endDate: "asc" },
    });

    if (!activeSub) {
      skippedNoSubscriptionCount += 1;
      continue;
    }

    const totalPaid = activeSub.payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (totalPaid < activeSub.amount) {
      skippedUnpaidSubscriptionCount += 1;
      continue;
    }

    if (activeSub.plan.sportId && activeSub.plan.sportId !== group.sportId) {
      skippedSportMismatchCount += 1;
      continue;
    }

    const existing = existingByMemberId.get(memberId);

    if (existing?.status === "ACTIVE") {
      skippedAlreadyActiveCount += 1;
      continue;
    }

    const scheduleCheck = await checkScheduleConflictForAssignmentWindow(
      payload.groupId,
      memberId,
      assignmentStartDate,
      payload.endDate ? new Date(payload.endDate) : null,
    );
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
      skippedTypeMismatchCount,
      skippedNoSubscriptionCount,
      skippedUnpaidSubscriptionCount,
      skippedSportMismatchCount,
    },
  });
}

export async function DELETE(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "enrollment.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

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
  const now = new Date();

  const closed = await prisma.$transaction(async (tx) => {
    const result = await tx.groupMember.updateMany({
      where: {
        groupId: payload.groupId,
        memberId: { in: uniqueMemberIds },
        status: "ACTIVE",
      },
      data: {
        status: "INACTIVE",
        endDate: now,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "GROUP_MEMBERS_CLOSED",
        entityType: "GroupMember",
        entityId: payload.groupId,
        userId: actor.id,
        details: JSON.stringify({
          memberIds: uniqueMemberIds,
          closedAt: now.toISOString(),
          closedCount: result.count,
        }),
      },
    });

    return result;
  });

  return NextResponse.json({
    data: {
      groupId: payload.groupId,
      requestedCount: uniqueMemberIds.length,
      closedCount: closed.count,
    },
  });
}
