import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
  const { id } = await params;

  try {
    const deleted = await prisma.$transaction(async (tx) => {
      await tx.groupMember.deleteMany({ where: { memberId: id } });

      const member = await tx.member.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          action: "MEMBER_DELETED",
          entityType: "Member",
          entityId: member.id,
          details: JSON.stringify({
            firstName: member.firstName,
            lastName: member.lastName,
            phone: member.phone,
          }),
        },
      });

      return member;
    });

    return NextResponse.json({
      data: {
        id: deleted.id,
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
