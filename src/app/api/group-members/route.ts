import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createGroupMemberSchema, updateGroupMemberSchema } from "@/lib/schemas/group-member";
import { requireAuth } from "@/lib/request-user";
import { resolveActiveSubscription } from "@/lib/membership-rules";

export const runtime = "nodejs";

function isMemberAllowed(groupType: "KIDS" | "ADULTS", memberType: "KID" | "ADULT" | "NOT_SPECIFIED") {
  if (groupType === "KIDS") {
    return memberType === "KID" || memberType === "NOT_SPECIFIED";
  }
  return memberType === "ADULT" || memberType === "NOT_SPECIFIED";
}

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

async function ensureCapacity(groupId: string, ignoredAssignmentId?: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      capacity: true,
      _count: {
        select: {
          members: {
            where: {
              status: "ACTIVE",
              ...(ignoredAssignmentId ? { NOT: { id: ignoredAssignmentId } } : {}),
            },
          },
        },
      },
    },
  });

  if (!group) {
    return { ok: false as const, status: 404, error: "Groupe introuvable" };
  }

  if (group._count.members >= group.capacity) {
    return { ok: false as const, status: 409, error: "Capacité du groupe atteinte" };
  }

  return { ok: true as const };
}

export async function GET(request: Request) {
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId")?.trim();
  const memberId = searchParams.get("memberId")?.trim();

  const assignments = await prisma.groupMember.findMany({
    where: {
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
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
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

  const group = await prisma.group.findUnique({
    where: { id: parsed.data.groupId },
    select: { id: true, isActive: true, groupType: true, sportId: true },
  });
  if (!group) {
    return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  }

  if (!group.isActive) {
    return NextResponse.json({ error: "Impossible d'affecter un groupe inactif" }, { status: 409 });
  }

  const member = await prisma.member.findUnique({
    where: { id: parsed.data.memberId },
    select: { id: true, status: true, memberType: true },
  });
  if (!member) {
    return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
  }

  if (member.status !== "ACTIVE") {
    return NextResponse.json({ error: "Impossible d'affecter un membre résilié" }, { status: 409 });
  }

  if (!isMemberAllowed(group.groupType, member.memberType)) {
    return NextResponse.json({ error: "Type de membre incompatible avec ce groupe" }, { status: 409 });
  }

  const selectedPlanId = parsed.data.planId?.trim() ?? "";
  if (!selectedPlanId) {
    return NextResponse.json({ error: "planId requis pour créer l'abonnement automatiquement" }, { status: 400 });
  }

  const selectedPlan = await prisma.subscriptionPlan.findUnique({
    where: { id: selectedPlanId },
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

  const capacityCheck = await ensureCapacity(parsed.data.groupId);
  if (!capacityCheck.ok) {
    return NextResponse.json({ error: capacityCheck.error }, { status: capacityCheck.status });
  }

  const scheduleCheck = await checkScheduleConflict(parsed.data.groupId, parsed.data.memberId);
  if (!scheduleCheck.ok) {
    return NextResponse.json({ error: scheduleCheck.error }, { status: 409 });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const groupCapacity = await tx.group.findUnique({
        where: { id: parsed.data.groupId },
        select: {
          capacity: true,
          _count: { select: { members: { where: { status: "ACTIVE" } } } },
        },
      });

      if (!groupCapacity) throw new Error("GROUP_NOT_FOUND");
      if (groupCapacity._count.members >= groupCapacity.capacity) {
        throw new Error("GROUP_CAPACITY_REACHED");
      }

      const activeCompatibleSubscription = await tx.memberSubscription.findFirst({
        where: {
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
            memberId: parsed.data.memberId,
            sportId: group.sportId,
            status: "ACTIVE",
          },
          data: { status: "EXPIRED" },
        });

        await tx.memberSubscription.create({
          data: {
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
      }

      const createdAssignment = await tx.groupMember.create({
        data: {
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
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
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
    const existing = await prisma.groupMember.findUnique({ 
      where: { id: groupMemberId }, 
      select: { id: true, groupId: true, memberId: true, group: { select: { sportId: true } } } 
    });
    if (!existing) {
      return NextResponse.json({ error: "Affectation introuvable" }, { status: 404 });
    }

    if (payload.status === "ACTIVE") {
      const capacityCheck = await ensureCapacity(existing.groupId, groupMemberId);
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

      const existingMember = await prisma.groupMember.findUnique({
        where: { id: groupMemberId },
        select: { memberId: true },
      });
      if (existingMember) {
        const scheduleCheck = await checkScheduleConflict(existing.groupId, existingMember.memberId);
        if (!scheduleCheck.ok) {
          return NextResponse.json({ error: scheduleCheck.error }, { status: 409 });
        }
      }
    }

    const startDate = payload.startDate ? new Date(payload.startDate) : undefined;
    const endDate =
      payload.endDate === undefined ? undefined : payload.endDate === null ? null : new Date(payload.endDate);

    if (startDate && endDate && endDate.getTime() < startDate.getTime()) {
      return NextResponse.json({ error: "La date de fin doit être >= date de début" }, { status: 400 });
    }

    const updated = await prisma.groupMember.update({
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

    return NextResponse.json({ data: toGroupMemberDto(updated) });
  } catch {
    return NextResponse.json({ error: "Erreur serveur lors de la modification" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
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
    await prisma.groupMember.delete({ where: { id: groupMemberId } });
    return NextResponse.json({ data: { id: groupMemberId } });
  } catch {
    return NextResponse.json({ error: "Erreur serveur lors de la suppression" }, { status: 500 });
  }
}
