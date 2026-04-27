import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createGroupMemberSchema, updateGroupMemberSchema } from "@/lib/schemas/group-member";

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

  const group = await prisma.group.findUnique({ where: { id: parsed.data.groupId }, select: { id: true, isActive: true } });
  if (!group) {
    return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  }

  if (!group.isActive) {
    return NextResponse.json({ error: "Impossible d'affecter un groupe inactif" }, { status: 409 });
  }

  const member = await prisma.member.findUnique({ where: { id: parsed.data.memberId }, select: { id: true, status: true } });
  if (!member) {
    return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
  }

  if (member.status !== "ACTIVE") {
    return NextResponse.json({ error: "Impossible d'affecter un membre archivé" }, { status: 409 });
  }

  const capacityCheck = await ensureCapacity(parsed.data.groupId);
  if (!capacityCheck.ok) {
    return NextResponse.json({ error: capacityCheck.error }, { status: capacityCheck.status });
  }

  try {
    const created = await prisma.groupMember.create({
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

    return NextResponse.json({ error: "Erreur serveur lors de l'affectation" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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
    const existing = await prisma.groupMember.findUnique({ where: { id: groupMemberId }, select: { id: true, groupId: true } });
    if (!existing) {
      return NextResponse.json({ error: "Affectation introuvable" }, { status: 404 });
    }

    if (payload.status === "ACTIVE") {
      const capacityCheck = await ensureCapacity(existing.groupId, groupMemberId);
      if (!capacityCheck.ok) {
        return NextResponse.json({ error: capacityCheck.error }, { status: capacityCheck.status });
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
