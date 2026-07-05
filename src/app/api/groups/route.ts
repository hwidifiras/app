import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createGroupSchema, updateGroupSchema } from "@/lib/schemas/group";
import { normalizeGroupRoomInput } from "@/lib/group-room";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { utcDateOnlyForTimeZone } from "@/lib/dates";
import { findCoachSessionConflict, formatSessionSlotLabel } from "@/lib/session-slot-conflict";
import { getClubSettings } from "@/lib/club-settings";
import { checkGroupMemberCompatibility } from "@/lib/demographics";
import {
  coachSportOverrideAuditDetails,
  validateCoachSportEligibility,
} from "@/lib/coach-qualification-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DayOfWeekValue =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

type GroupAuditSource = {
  id: string;
  name: string;
  groupType: string;
  genderPolicy: string;
  sportId: string;
  coachId: string;
  capacity: number;
  room: string | null;
  isActive: boolean;
  sport?: { name: string } | null;
  coach?: { firstName: string; lastName: string } | null;
};

function groupAuditSnapshot(group: GroupAuditSource) {
  return {
    id: group.id,
    name: group.name,
    groupType: group.groupType,
    genderPolicy: group.genderPolicy,
    sportId: group.sportId,
    sportName: group.sport?.name ?? null,
    coachId: group.coachId,
    coachName: group.coach ? `${group.coach.firstName} ${group.coach.lastName}` : null,
    capacity: group.capacity,
    room: group.room,
    isActive: group.isActive,
  };
}

function toGroupDto(group: {
  id: string;
  name: string;
  groupType: "KIDS" | "ADULTS" | "MIXED";
  genderPolicy: "MALE_ONLY" | "FEMALE_ONLY" | "MIXED";
  sportId: string;
  coachId: string;
  capacity: number;
  room: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  sport: { name: string };
  coach: { firstName: string; lastName: string };
  schedules: {
    id: string;
    dayOfWeek: DayOfWeekValue;
    startTime: string;
    durationMinutes: number;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    createdAt: Date;
  }[];
  _count?: { members: number };
}) {
  return {
    id: group.id,
    name: group.name,
    activeMembers: group._count?.members ?? 0,
    groupType: group.groupType,
    genderPolicy: group.genderPolicy,
    sportId: group.sportId,
    sportName: group.sport.name,
    coachId: group.coachId,
    coachName: `${group.coach.firstName} ${group.coach.lastName}`,
    capacity: group.capacity,
    room: group.room,
    isActive: group.isActive,
    schedules: group.schedules.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      durationMinutes: s.durationMinutes,
      effectiveFrom: s.effectiveFrom.toISOString(),
      effectiveTo: s.effectiveTo?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    })),
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "catalog.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

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
      schedules: { orderBy: { createdAt: "asc" } },
      _count: { select: { members: { where: { status: "ACTIVE" } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ data: groups.map(toGroupDto) });
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "catalog.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

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

  const eligibility = await validateCoachSportEligibility({
    coachId: parsed.data.coachId,
    sportId: parsed.data.sportId,
    actor,
    overrideReason: parsed.data.coachSportOverrideReason,
  });

  if (!eligibility.ok) {
    return NextResponse.json(
      { error: eligibility.error, code: eligibility.code },
      { status: eligibility.status },
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    const group = await tx.group.create({
      data: {
        name: parsed.data.name,
        groupType: parsed.data.groupType,
        genderPolicy: parsed.data.genderPolicy,
        sportId: parsed.data.sportId,
        coachId: parsed.data.coachId,
        capacity: parsed.data.capacity,
        room: normalizeGroupRoomInput(parsed.data.room),
      },
      include: {
        sport: { select: { name: true } },
        coach: { select: { firstName: true, lastName: true } },
        schedules: { orderBy: { createdAt: "asc" } },
      },
    });

    await tx.auditLog.create({
      data: {
        action: "GROUP_CREATED",
        entityType: "Group",
        entityId: group.id,
        userId: actor.id,
        details: JSON.stringify({
          after: groupAuditSnapshot(group),
        }),
      },
    });

    const details = coachSportOverrideAuditDetails(eligibility, {
      groupId: group.id,
      groupName: group.name,
      operation: "GROUP_CREATE",
    });

    if (details) {
      await tx.auditLog.create({
        data: {
          action: "COACH_SPORT_OVERRIDE_USED",
          entityType: "Group",
          entityId: group.id,
          userId: actor.id,
          details,
        },
      });
    }

    return group;
  });

  return NextResponse.json({ data: toGroupDto(created) }, { status: 201 });
}

export async function PATCH(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "catalog.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

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
  const existingGroup = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      sportId: true,
      coachId: true,
      capacity: true,
      room: true,
      groupType: true,
      genderPolicy: true,
      isActive: true,
      sport: { select: { name: true } },
      coach: { select: { firstName: true, lastName: true } },
      members: {
        where: { status: "ACTIVE" },
        select: {
          member: {
            select: {
              firstName: true,
              lastName: true,
              memberType: true,
              gender: true,
            },
          },
        },
      },
    },
  });

  if (!existingGroup) {
    return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
  }

  const targetGroupType = payload.groupType ?? existingGroup.groupType;
  const targetGenderPolicy = payload.genderPolicy ?? existingGroup.genderPolicy;
  const incompatibleMember = existingGroup.members.find((assignment) => {
    return !checkGroupMemberCompatibility({
      groupType: targetGroupType,
      genderPolicy: targetGenderPolicy,
      memberType: assignment.member.memberType,
      gender: assignment.member.gender,
    }).ok;
  });

  if (incompatibleMember) {
    return NextResponse.json(
      {
        error: `Modification impossible: ${incompatibleMember.member.firstName} ${incompatibleMember.member.lastName} est deja affecte(e) et ne correspond pas a cette politique.`,
      },
      { status: 409 },
    );
  }

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

  const targetSportId = payload.sportId ?? existingGroup.sportId;
  const targetCoachId = payload.coachId ?? existingGroup.coachId;
  const coachSportPairChanged =
    targetSportId !== existingGroup.sportId || targetCoachId !== existingGroup.coachId;
  let eligibility: Awaited<ReturnType<typeof validateCoachSportEligibility>> | null = null;

  if (coachSportPairChanged) {
    eligibility = await validateCoachSportEligibility({
      coachId: targetCoachId,
      sportId: targetSportId,
      actor,
      overrideReason: payload.coachSportOverrideReason,
    });

    if (!eligibility.ok) {
      return NextResponse.json(
        { error: eligibility.error, code: eligibility.code },
        { status: eligibility.status },
      );
    }
  }

  const shouldApplyCoachToFutureSessions = Boolean(
    payload.applyCoachToFutureSessions &&
      payload.coachId &&
      payload.coachId !== existingGroup.coachId,
  );

  const futureSessionsForCoachPropagation = shouldApplyCoachToFutureSessions
    ? await prisma.session.findMany({
        where: {
          groupId,
          sessionDate: { gte: utcDateOnlyForTimeZone(new Date()) },
          status: { in: ["PLANNED", "RESCHEDULED"] },
          attendances: { none: {} },
        },
        select: {
          id: true,
          sessionDate: true,
          startTime: true,
          endTime: true,
          room: true,
        },
        orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
      })
    : [];

  if (shouldApplyCoachToFutureSessions) {
    const settings = await getClubSettings();
    for (const session of futureSessionsForCoachPropagation) {
      const coachConflict = await findCoachSessionConflict({
        coachId: targetCoachId,
        sessionDate: session.sessionDate,
        startTime: session.startTime,
        endTime: session.endTime,
        excludeIds: [session.id],
        room: session.room || existingGroup.room,
        groupSportId: targetSportId,
        allowConcurrentSameRoomQualified: settings.allowCoachConcurrentSameRoomQualified,
      });

      if (coachConflict?.coach) {
        const coachName = `${coachConflict.coach.firstName} ${coachConflict.coach.lastName}`;
        return NextResponse.json(
          {
            error: `Impossible d'appliquer ce coach aux seances futures: ${coachName} est deja assigne a "${coachConflict.group.name}" le ${formatSessionSlotLabel(session.sessionDate, coachConflict.startTime)}.`,
          },
          { status: 409 },
        );
      }
    }
  }

  try {
    const updatedGroup = await prisma.$transaction(async (tx) => {
      const group = await tx.group.update({
        where: { id: groupId },
        data: {
          name: payload.name,
          groupType: payload.groupType,
          genderPolicy: payload.genderPolicy,
          sportId: payload.sportId,
          coachId: payload.coachId,
          capacity: payload.capacity,
          room: payload.room === undefined ? undefined : normalizeGroupRoomInput(payload.room),
          isActive: payload.isActive,
        },
        include: {
          sport: { select: { name: true } },
          coach: { select: { firstName: true, lastName: true } },
          schedules: { orderBy: { createdAt: "asc" } },
        },
      });

      await tx.auditLog.create({
        data: {
          action: "GROUP_UPDATED",
          entityType: "Group",
          entityId: group.id,
          userId: actor.id,
          details: JSON.stringify({
            fields: Object.entries(payload)
              .filter(
                ([field, value]) =>
                  value !== undefined &&
                  field !== "applyCoachToFutureSessions" &&
                  field !== "coachSportOverrideReason",
              )
              .map(([field]) => field),
            before: groupAuditSnapshot(existingGroup),
            after: groupAuditSnapshot(group),
            appliedCoachToFutureSessions:
              shouldApplyCoachToFutureSessions && futureSessionsForCoachPropagation.length > 0
                ? futureSessionsForCoachPropagation.length
                : 0,
          }),
        },
      });

      const details = eligibility?.ok
        ? coachSportOverrideAuditDetails(eligibility, {
            groupId: group.id,
            groupName: group.name,
            previousSportId: existingGroup.sportId,
            previousCoachId: existingGroup.coachId,
            operation: "GROUP_UPDATE",
          })
        : null;

      if (details) {
        await tx.auditLog.create({
          data: {
            action: "COACH_SPORT_OVERRIDE_USED",
            entityType: "Group",
            entityId: group.id,
            userId: actor.id,
            details,
          },
        });
      }

      if (shouldApplyCoachToFutureSessions && futureSessionsForCoachPropagation.length > 0) {
        const sessionIds = futureSessionsForCoachPropagation.map((session) => session.id);
        const updateResult = await tx.session.updateMany({
          where: { id: { in: sessionIds } },
          data: { coachId: targetCoachId },
        });

        await tx.auditLog.create({
          data: {
            action: "GROUP_COACH_PROPAGATED",
            entityType: "Group",
            entityId: group.id,
            userId: actor.id,
            details: JSON.stringify({
              groupId: group.id,
              groupName: group.name,
              previousCoachId: existingGroup.coachId,
              nextCoachId: targetCoachId,
              affectedSessions: updateResult.count,
              rule: "future_sessions_without_attendance",
            }),
          },
        });
      }

      return group;
    });

    return NextResponse.json({ data: toGroupDto(updatedGroup) });
  } catch {
    return NextResponse.json({ error: "Erreur serveur lors de la modification" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "catalog.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

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
    const deactivated = await prisma.$transaction(async (tx) => {
      const group = await tx.group.update({
        where: { id: groupId },
        data: { isActive: false },
        include: {
          sport: { select: { name: true } },
          coach: { select: { firstName: true, lastName: true } },
          schedules: { orderBy: { createdAt: "asc" } },
          _count: { select: { members: { where: { status: "ACTIVE" } } } },
        },
      });

      await tx.auditLog.create({
        data: {
          action: "GROUP_DEACTIVATED",
          entityType: "Group",
          entityId: groupId,
          userId: actor.id,
          details: JSON.stringify({ deactivatedAt: new Date().toISOString() }),
        },
      });

      return group;
    });

    return NextResponse.json({
      data: toGroupDto(deactivated),
    });
  } catch {
    return NextResponse.json({ error: "Erreur serveur lors de la désactivation du cours" }, { status: 500 });
  }
}
