import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { updateMemberSchema } from "@/lib/schemas/member";
import { expireStaleSubscriptions } from "@/lib/membership-rules";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(_request, "members.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const { id } = await params;

  try {
    const member = await prisma.member.findUnique({
      where: { id },
      include: {
        groups: {
          where: { status: "ACTIVE" },
          include: {
            group: {
              select: {
                id: true,
                name: true,
                sport: { select: { name: true } },
                coach: { select: { firstName: true, lastName: true } },
                room: true,
                schedules: { orderBy: { createdAt: "asc" }, take: 1 },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Membre introuvable" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      data: {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        phone: member.phone,
        email: member.email,
        memberType: member.memberType,
        birthDate: member.birthDate?.toISOString() ?? null,
        address: member.address ?? null,
        parentName: member.parentName ?? null,
        parentPhone: member.parentPhone ?? null,
        parentAddress: member.parentAddress ?? null,
        status: member.status,
        joinedAt: member.joinedAt.toISOString(),
        archivedAt: member.archivedAt?.toISOString() ?? null,
        createdAt: member.createdAt.toISOString(),
        updatedAt: member.updatedAt.toISOString(),
        groupMemberships: (
          member.groups as unknown as Array<{
            id: string;
            groupId: string;
            group: {
              name: string;
              sport: { name: string } | null;
              coach: { firstName: string; lastName: string } | null;
              room: string;
              schedules: Array<{
                dayOfWeek: string;
                startTime: string;
                durationMinutes: number;
              }>;
            };
            startDate: Date;
            endDate: Date | null;
            status: string;
          }>
        ).map((gm) => ({
          id: gm.id,
          groupId: gm.groupId,
          groupName: gm.group.name,
          sportName: gm.group.sport?.name ?? null,
          coachName: gm.group.coach
            ? `${gm.group.coach.firstName} ${gm.group.coach.lastName}`
            : null,
          room: gm.group.room,
          schedule: gm.group.schedules[0]
            ? {
                dayOfWeek: gm.group.schedules[0].dayOfWeek,
                startTime: gm.group.schedules[0].startTime,
                durationMinutes: gm.group.schedules[0].durationMinutes,
              }
            : null,
          startDate: gm.startDate.toISOString(),
          endDate: gm.endDate?.toISOString() ?? null,
          status: gm.status,
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/members/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let actor;
  try {
    actor = await requirePermission(_request, "members.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const { id } = await params;

  try {
    const now = new Date();
    const archived = await prisma.$transaction(async (tx) => {
      const member = await tx.member.update({
        where: { id },
        data: {
          status: "ARCHIVED",
          archivedAt: now,
        },
      });

      await tx.groupMember.updateMany({
        where: { memberId: id, status: "ACTIVE" },
        data: {
          status: "INACTIVE",
          endDate: now,
        },
      });

      await tx.memberSubscription.updateMany({
        where: { memberId: id, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });

      await tx.auditLog.create({
        data: {
          action: "MEMBER_ARCHIVED",
          entityType: "Member",
          entityId: member.id,
          userId: actor.id,
          details: JSON.stringify({
            firstName: member.firstName,
            lastName: member.lastName,
            phone: member.phone,
            archivedAt: now.toISOString(),
          }),
        },
      });

      return member;
    });

    await expireStaleSubscriptions(id);

    return NextResponse.json({
      data: {
        id: archived.id,
        status: archived.status,
        archivedAt: archived.archivedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: string }).code
        : null;

    if (errorCode === "P2025") {
      return NextResponse.json(
        { error: "Membre introuvable" },
        { status: 404 },
      );
    }

    if (errorCode === "P2003") {
      return NextResponse.json(
        {
          error:
            "Impossible de supprimer ce membre à cause de dépendances liées",
        },
        { status: 409 },
      );
    }

    console.error("DELETE /api/members/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(request, "members.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const { id } = await params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = updateMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation echouee",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (payload.firstName !== undefined) updateData.firstName = payload.firstName.trim();
  if (payload.lastName !== undefined) updateData.lastName = payload.lastName.trim();
  if (payload.phone !== undefined) updateData.phone = payload.phone.trim();
  if (payload.memberType !== undefined) updateData.memberType = payload.memberType;
  if (payload.birthDate !== undefined) updateData.birthDate = new Date(payload.birthDate);
  if (payload.email !== undefined) updateData.email = payload.email ? payload.email.trim() : null;
  if (payload.address !== undefined) updateData.address = payload.address ? payload.address.trim() : null;
  if (payload.parentName !== undefined) updateData.parentName = payload.parentName ? payload.parentName.trim() : null;
  if (payload.parentPhone !== undefined) updateData.parentPhone = payload.parentPhone ? payload.parentPhone.trim() : null;
  if (payload.parentAddress !== undefined) updateData.parentAddress = payload.parentAddress ? payload.parentAddress.trim() : null;

  if (payload.memberType && payload.memberType !== "KID") {
    updateData.parentName = null;
    updateData.parentPhone = null;
    updateData.parentAddress = null;
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const member = await tx.member.update({
        where: { id },
        data: updateData,
      });

      await tx.auditLog.create({
        data: {
          action: "MEMBER_UPDATED",
          entityType: "Member",
          entityId: member.id,
          details: JSON.stringify({
            fields: Object.keys(updateData),
          }),
        },
      });

      return member;
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
        email: updated.email,
        memberType: updated.memberType,
        birthDate: updated.birthDate?.toISOString() ?? null,
        address: updated.address ?? null,
        parentName: updated.parentName ?? null,
        parentPhone: updated.parentPhone ?? null,
        parentAddress: updated.parentAddress ?? null,
        status: updated.status,
        joinedAt: updated.joinedAt.toISOString(),
        archivedAt: updated.archivedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("PATCH /api/members/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
