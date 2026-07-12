import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createSubscriptionEntitlementSnapshots } from "@/lib/subscription-entitlements";
import { createGroupMemberSchema, updateGroupMemberSchema } from "@/lib/schemas/group-member";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { resolveActiveSubscription } from "@/lib/membership-rules";
import { checkScheduleConflictForAssignmentWindow, ensureGroupCapacityOnDate } from "@/lib/assignment-policy";
import { checkGroupMemberCompatibility } from "@/lib/demographics";

export const runtime = "nodejs";

function toGroupMemberDto(item: {
  id: string;
  groupId: string;
  memberId: string;
  startDate: Date;
  endDate: Date | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
  group: { name: string };
  member: { firstName: string; lastName: string; phone: string };
}) {
  return {
    id: item.id,
    groupId: item.groupId,
    groupName: item.group.name,
    memberId: item.memberId,
    memberName: `${item.member.firstName} ${item.member.lastName}`,
    memberPhone: item.member.phone,
    startDate: item.startDate.toISOString(),
    endDate: item.endDate?.toISOString() ?? null,
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "enrollment.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId")?.trim();
  const memberId = searchParams.get("memberId")?.trim();

  const assignments = await prisma.groupMember.findMany({
    where: {
      tenantId: actor.tenantId,
      ...(groupId ? { groupId } : {}),
      ...(memberId ? { memberId } : {}),
    },
    include: {
      group: { select: { name: true } },
      member: { select: { firstName: true, lastName: true, phone: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  return NextResponse.json({ data: assignments.map(toGroupMemberDto) });
}

export async function POST(request: Request) {
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

  const parsed = createGroupMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const group = await prisma.group.findFirst({
    where: { id: parsed.data.groupId, tenantId: actor.tenantId },
    select: { id: true, isActive: true, groupType: true, genderPolicy: true, sportId: true },
  });
  if (!group) {
    return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  }

  if (!group.isActive) {
    return NextResponse.json({ error: "Impossible d'affecter un groupe inactif" }, { status: 409 });
  }

  const member = await prisma.member.findFirst({
    where: { id: parsed.data.memberId, tenantId: actor.tenantId },
    select: { id: true, status: true, memberType: true, gender: true },
  });
  if (!member) {
    return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
  }

  if (member.status !== "ACTIVE") {
    return NextResponse.json({ error: "Impossible d'affecter un membre résilié" }, { status: 409 });
  }

  const compatibility = checkGroupMemberCompatibility({
    groupType: group.groupType,
    genderPolicy: group.genderPolicy,
    memberType: member.memberType,
    gender: member.gender,
  });

  if (!compatibility.ok) {
    return NextResponse.json({ error: compatibility.message }, { status: 409 });
  }

  const selectedPlanId = parsed.data.planId?.trim() ?? "";
  if (!selectedPlanId) {
    return NextResponse.json({ error: "planId requis pour créer l'abonnement automatiquement" }, { status: 400 });
  }

  const selectedPlan = await prisma.subscriptionPlan.findFirst({
    where: { id: selectedPlanId, tenantId: actor.tenantId },
    select: { id: true, name: true, price: true, totalSessions: true, validityDays: true, sportId: true, isActive: true },
  });

  if (!selectedPlan) {
    return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
  }

  if (!selectedPlan.isActive) {
    return NextResponse.json({ error: "Plan inactif" }, { status: 409 });
  }

  if (selectedPlan.sportId && selectedPlan.sportId !== group.sportId) {
    return NextResponse.json({ error: "Le plan choisi n'est pas compatible avec le sport de ce groupe" }, { status: 403 });
  }

  const assignmentStartDate = new Date(parsed.data.startDate);
  const assignmentEndDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;
  const capacityCheck = await ensureGroupCapacityOnDate(parsed.data.groupId, assignmentStartDate);
  if (!capacityCheck.ok) {
    return NextResponse.json({ error: capacityCheck.error }, { status: capacityCheck.status });
  }

  const scheduleCheck = await checkScheduleConflictForAssignmentWindow(
    parsed.data.groupId,
    parsed.data.memberId,
    assignmentStartDate,
    assignmentEndDate,
  );
  if (!scheduleCheck.ok) {
    return NextResponse.json({ error: scheduleCheck.error }, { status: 409 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const now = new Date();
      let createdSubscriptionId: string | null = null;
      const groupCapacity = await tx.group.findFirst({
        where: { id: parsed.data.groupId, tenantId: actor.tenantId },
        select: {
          capacity: true,
          _count: {
            select: {
              members: {
                where: {
                  status: "ACTIVE",
                  startDate: { lte: assignmentStartDate },
                  OR: [{ endDate: null }, { endDate: { gte: assignmentStartDate } }],
                },
              },
            },
          },
        },
      });

      if (!groupCapacity) throw new Error("GROUP_NOT_FOUND");
      if (groupCapacity._count.members >= groupCapacity.capacity) {
        throw new Error("GROUP_CAPACITY_REACHED");
      }

      const activeCompatibleSubscription = await tx.memberSubscription.findFirst({
        where: {
          tenantId: actor.tenantId,
          memberId: parsed.data.memberId,
          sportId: group.sportId,
          status: "ACTIVE",
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
          remainingSessions: { gt: 0 },
        },
        select: { id: true },
      });

      if (!activeCompatibleSubscription) {
        const start = new Date(parsed.data.startDate);
        const endDate = parsed.data.endDate
          ? new Date(parsed.data.endDate)
          : (() => {
              const e = new Date(start);
              e.setDate(e.getDate() + selectedPlan.validityDays);
              return e;
            })();

        await tx.memberSubscription.updateMany({
          where: {
            tenantId: actor.tenantId,
            memberId: parsed.data.memberId,
            sportId: group.sportId,
            status: "ACTIVE",
          },
          data: { status: "EXPIRED" },
        });

        const subscription = await tx.memberSubscription.create({
          data: {
            tenantId: actor.tenantId,
            memberId: parsed.data.memberId,
            planId: selectedPlan.id,
            sportId: group.sportId,
            startDate: start,
            endDate,
            amount: selectedPlan.price,
            remainingSessions: selectedPlan.totalSessions,
            status: "ACTIVE",
          },
        });
        await createSubscriptionEntitlementSnapshots(tx, {
          tenantId: actor.tenantId,
          memberSubscriptionId: subscription.id,
          planId: selectedPlan.id,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
          legacyRemainingSessions: subscription.remainingSessions,
        });
        createdSubscriptionId = subscription.id;
      }

      const createdAssignment = await tx.groupMember.create({
        data: {
          tenantId: actor.tenantId,
          groupId: parsed.data.groupId,
          memberId: parsed.data.memberId,
          startDate: new Date(parsed.data.startDate),
          endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
          status: "ACTIVE",
        },
        include: {
          group: { select: { name: true } },
          member: { select: { firstName: true, lastName: true, phone: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "GROUP_MEMBER_CREATED",
          entityType: "GroupMember",
          entityId: createdAssignment.id,
          userId: actor.id,
          details: JSON.stringify({
            tenantId: actor.tenantId,
            after: toGroupMemberDto(createdAssignment),
            createdSubscriptionId,
            planId: selectedPlan.id,
          }),
        },
      });

      return createdAssignment;
    });

    return NextResponse.json({ data: toGroupMemberDto(created) }, { status: 201 });
  } catch (error) {
    const isDuplicateAssignment =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

    if (isDuplicateAssignment) {
      return NextResponse.json({ error: "Ce membre est déjà affecté à ce groupe" }, { status: 409 });
    }

    if (error instanceof Error && error.message === "GROUP_CAPACITY_REACHED") {
      return NextResponse.json({ error: "Capacité du groupe atteinte" }, { status: 409 });
    }

    if (error instanceof Error && error.message === "GROUP_NOT_FOUND") {
      return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de l'affectation" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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

  if (typeof body !== "object" || body === null || !("groupMemberId" in body)) {
    return NextResponse.json({ error: "groupMemberId requis" }, { status: 400 });
  }

  const groupMemberId = (body as { groupMemberId?: unknown }).groupMemberId;

  if (typeof groupMemberId !== "string" || groupMemberId.trim().length === 0) {
    return NextResponse.json({ error: "groupMemberId invalide" }, { status: 400 });
  }

  const updatePayload = updateGroupMemberSchema.safeParse((body as Record<string, unknown>).payload);

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
    const existing = await prisma.groupMember.findFirst({
      where: { id: groupMemberId, tenantId: actor.tenantId },
      include: {
        group: { select: { name: true, sportId: true } },
        member: { select: { firstName: true, lastName: true, phone: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Affectation introuvable" }, { status: 404 });
    }

    const targetStartDate = payload.startDate ? new Date(payload.startDate) : existing.startDate;
    const targetEndDate =
      payload.endDate === undefined ? existing.endDate : payload.endDate === null ? null : new Date(payload.endDate);

    if (payload.status === "ACTIVE") {
      const capacityCheck = await ensureGroupCapacityOnDate(existing.groupId, targetStartDate, groupMemberId);
      if (!capacityCheck.ok) {
        return NextResponse.json({ error: capacityCheck.error }, { status: capacityCheck.status });
      }

      const activeSub = await resolveActiveSubscription(existing.memberId, existing.group.sportId);

      if (!activeSub) {
        return NextResponse.json({ error: "Le membre doit avoir un abonnement actif pour cette discipline" }, { status: 403 });
      }

      const settings = await import("@/lib/club-settings").then((m) => m.getClubSettings());
      const paidEnough =
        activeSub.totalPaid >= activeSub.amount ||
        (settings.allowCheckInWithPartialPayment && activeSub.totalPaid > 0);

      if (!paidEnough) {
        return NextResponse.json({ error: "Le membre doit solder son abonnement avant d'être réaffecté à un cours" }, { status: 403 });
      }

      const scheduleCheck = await checkScheduleConflictForAssignmentWindow(
        existing.groupId,
        existing.memberId,
        targetStartDate,
        targetEndDate,
        groupMemberId,
      );
      if (!scheduleCheck.ok) {
        return NextResponse.json({ error: scheduleCheck.error }, { status: 409 });
      }
    }

    const startDate = payload.startDate ? targetStartDate : undefined;
    const endDate = payload.endDate === undefined ? undefined : targetEndDate;

    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      return NextResponse.json({ error: "La date de fin doit être >= date de début" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.groupMember.update({
        where: { id: groupMemberId },
        data: {
          startDate,
          endDate,
          status: payload.status,
        },
        include: {
          group: { select: { name: true } },
          member: { select: { firstName: true, lastName: true, phone: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "GROUP_MEMBER_UPDATED",
          entityType: "GroupMember",
          entityId: groupMemberId,
          userId: actor.id,
          details: JSON.stringify({
            tenantId: actor.tenantId,
            before: toGroupMemberDto(existing),
            after: toGroupMemberDto(next),
          }),
        },
      });

      return next;
    });

    return NextResponse.json({ data: toGroupMemberDto(updated) });
  } catch {
    return NextResponse.json({ error: "Erreur serveur lors de la modification" }, { status: 500 });
  }
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

  if (typeof body !== "object" || body === null || !("groupMemberId" in body)) {
    return NextResponse.json({ error: "groupMemberId requis" }, { status: 400 });
  }

  const groupMemberId = (body as { groupMemberId?: unknown }).groupMemberId;

  if (typeof groupMemberId !== "string" || groupMemberId.trim().length === 0) {
    return NextResponse.json({ error: "groupMemberId invalide" }, { status: 400 });
  }

  try {
    const now = new Date();
    const closed = await prisma.$transaction(async (tx) => {
      const existing = await tx.groupMember.findFirst({
        where: { id: groupMemberId, tenantId: actor.tenantId },
        select: { id: true },
      });

      if (!existing) {
        throw new Error("GROUP_MEMBER_NOT_FOUND");
      }

      const assignment = await tx.groupMember.update({
        where: { id: existing.id },
        data: {
          status: "INACTIVE",
          endDate: now,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "GROUP_MEMBER_CLOSED",
          entityType: "GroupMember",
          entityId: groupMemberId,
          userId: actor.id,
          details: JSON.stringify({ tenantId: actor.tenantId, closedAt: now.toISOString() }),
        },
      });

      return assignment;
    });

    return NextResponse.json({ data: { id: closed.id, status: closed.status, endDate: closed.endDate?.toISOString() ?? null } });
  } catch (error) {
    if (error instanceof Error && error.message === "GROUP_MEMBER_NOT_FOUND") {
      return NextResponse.json({ error: "Affectation introuvable" }, { status: 404 });
    }

    return NextResponse.json({ error: "Erreur serveur lors du retrait" }, { status: 500 });
  }
}
