import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  dayOfWeekEnumFromDate,
  sessionDateOnWeekdayInSameWeek,
  utcDateOnlyForTimeZone,
  utcWeekdayIndex,
} from "@/lib/dates";
import { updateSessionSchema } from "@/lib/schemas/session";
import { jsonAuthFailureResponse, requireAnyPermission, requirePermission } from "@/lib/permissions";
import { coachSessionWhere } from "@/modules/classes/coach-scope";
import {
  formatSessionSlotLabel,
  validateSessionSlot,
} from "@/lib/session-slot-conflict";
import {
  assertNoAttendancesForSessionEdit,
  assertNoAttendancesForSessionIds,
  getSessionAttendanceCount,
  SessionEditBlockedError,
} from "@/lib/session-attendance-guard";
import {
  coachSportOverrideAuditDetails,
  validateCoachSportEligibility,
} from "@/lib/coach-qualification-policy";
import {
  addMinutesToTime,
  changedSessionFields,
  isPrismaErrorCode,
  sessionAuditSnapshot,
  sessionResponsePayload,
} from "@/lib/session-route-helpers";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let actor;
  try {
    actor = await requireAnyPermission(_request, ["class.attendance", "class.manage"]);
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const { id } = await params;

  const session = await prisma.session.findFirst({
    where: { id, tenantId: actor.tenantId, ...coachSessionWhere(actor) },
    include: {
      group: { select: { name: true, sportId: true } },
      coach: { select: { firstName: true, lastName: true } },
      schedule: {
        select: {
          dayOfWeek: true,
          durationMinutes: true,
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }

  const attendanceCount = await getSessionAttendanceCount(id, actor.tenantId);

  return NextResponse.json({
    data: {
      id: session.id,
      groupId: session.groupId,
      groupName: session.group.name,
      groupSportId: session.group.sportId,
      scheduleId: session.scheduleId,
      sessionDate: session.sessionDate.toISOString(),
      startTime: session.startTime,
      endTime: session.endTime,
      coachId: session.coachId,
      coachName: session.coach ? `${session.coach.firstName} ${session.coach.lastName}` : null,
      room: session.room,
      status: session.status,
      exceptionReason: session.exceptionReason,
      postponedTo: session.postponedTo ? session.postponedTo.toISOString() : null,
      postponementReason: session.postponementReason,
      postponementDetails: session.postponementDetails,
      schedule: session.schedule,
      attendanceCount,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let actor;
  try {
    actor = await requirePermission(request, "class.manage");
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

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body invalide" }, { status: 400 });
  }

  const { editMode, ...rest } = body as Record<string, unknown>;

  const parsed = updateSessionSchema.safeParse(rest);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const existing = await prisma.session.findFirst({
    where: { id, tenantId: actor.tenantId },
    select: {
      id: true,
      groupId: true,
      scheduleId: true,
      sessionDate: true,
      startTime: true,
      endTime: true,
      coachId: true,
      room: true,
      status: true,
      exceptionReason: true,
      postponedTo: true,
      postponementReason: true,
      postponementDetails: true,
      group: { select: { name: true, sportId: true } },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }
  if (existing.status === "COMPLETED") {
    return NextResponse.json(
      {
        error: "Cette séance est finalisée. Rouvrez-la depuis le pointage avant toute modification.",
      },
      { status: 409 },
    );
  }

  const payload = parsed.data;
  const isPermanent = editMode === "permanent";
  const changeReason = payload.changeReason?.trim() ?? "";

  if (payload.status === "COMPLETED") {
    return NextResponse.json(
      {
        error: "Finalisez la séance depuis l'écran de pointage après avoir renseigné tous les membres.",
      },
      { status: 409 },
    );
  }

  if (isPermanent && !existing.scheduleId) {
    return NextResponse.json(
      {
        error:
          "Cette séance n'est pas liée à un créneau récurrent. Utilisez le mode Exception pour modifier cette séance seule.",
      },
      { status: 400 },
    );
  }

  if (isPermanent && changeReason.length < 3) {
    return NextResponse.json(
      { error: "Motif obligatoire pour une modification permanente." },
      { status: 400 },
    );
  }

  const existingDateOnly = utcDateOnlyForTimeZone(existing.sessionDate);
  const nextSessionDate = payload.sessionDate ? utcDateOnlyForTimeZone(new Date(payload.sessionDate)) : undefined;

  if (payload.sessionDate && Number.isNaN(nextSessionDate?.getTime())) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }

  const targetDate = nextSessionDate ?? existingDateOnly;
  const targetStartTime = payload.startTime ?? existing.startTime;
  const targetEndTime = payload.endTime ?? existing.endTime;
  const targetCoachId = payload.coachId !== undefined ? payload.coachId : existing.coachId;
  const targetRoom = payload.room !== undefined ? payload.room : existing.room;
  const dateChanged = nextSessionDate !== undefined && nextSessionDate.getTime() !== existingDateOnly.getTime();
  const timeChanged = payload.startTime !== undefined && payload.startTime !== existing.startTime;
  const coachChanged = payload.coachId !== undefined && payload.coachId !== existing.coachId;
  const roomChanged = payload.room !== undefined && payload.room !== existing.room;
  let eligibility: Awaited<ReturnType<typeof validateCoachSportEligibility>> | null = null;

  if (coachChanged && targetCoachId) {
    eligibility = await validateCoachSportEligibility({
      coachId: targetCoachId,
      sportId: existing.group.sportId,
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

  if (dateChanged || timeChanged || coachChanged || roomChanged) {
    const conflictError = await validateSessionSlot({
      groupId: existing.groupId,
      groupName: existing.group.name,
      sessionDate: targetDate,
      startTime: targetStartTime,
      endTime: targetEndTime,
      coachId: targetCoachId,
      room: targetRoom,
      excludeIds: [id],
      groupSportId: existing.group.sportId,
    });

    if (conflictError) {
      return NextResponse.json({ error: conflictError }, { status: 409 });
    }
  }

  const sessionData: Record<string, unknown> = {
    ...(nextSessionDate !== undefined ? { sessionDate: nextSessionDate } : {}),
    ...(payload.coachId !== undefined ? { coachId: payload.coachId } : {}),
    ...(payload.room !== undefined ? { room: payload.room } : {}),
    ...(payload.startTime !== undefined ? { startTime: payload.startTime } : {}),
    ...(payload.endTime !== undefined ? { endTime: payload.endTime } : {}),
    ...(payload.status !== undefined ? { status: payload.status } : {}),
    ...(payload.exceptionReason !== undefined ? { exceptionReason: payload.exceptionReason } : {}),
  };

  if (!isPermanent && Object.keys(sessionData).length === 0) {
    return NextResponse.json({ error: "Aucune modification à enregistrer" }, { status: 400 });
  }

  try {
    // Permanent: same weekday + time on this session and every following week of the recurring slot
    if (isPermanent && existing.scheduleId) {
      const schedule = await prisma.groupSchedule.findFirst({
        where: { id: existing.scheduleId, tenantId: actor.tenantId },
        select: { durationMinutes: true, startTime: true },
      });

      if (!schedule) {
        return NextResponse.json({ error: "Créneau récurrent introuvable" }, { status: 404 });
      }

      const newStartTime = payload.startTime ?? existing.startTime;
      const newEndTime =
        payload.endTime ??
        (payload.startTime !== undefined
          ? addMinutesToTime(newStartTime, schedule.durationMinutes)
          : existing.startTime === newStartTime
            ? undefined
            : addMinutesToTime(newStartTime, schedule.durationMinutes));

      const targetWeekday =
        dateChanged && nextSessionDate ? utcWeekdayIndex(nextSessionDate) : null;

      const affectedSessions = await prisma.session.findMany({
        where: {
          tenantId: actor.tenantId,
          scheduleId: existing.scheduleId,
          sessionDate: { gte: existing.sessionDate },
        },
        select: { id: true, sessionDate: true },
        orderBy: { sessionDate: "asc" },
      });

      const affectedIds = affectedSessions.map((s) => s.id);

      try {
        await assertNoAttendancesForSessionIds(affectedIds, actor.tenantId);
      } catch (error) {
        if (error instanceof SessionEditBlockedError) {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }
        throw error;
      }

      const plannedUpdates: Array<{
        id: string;
        sessionDate: Date;
        startTime: string;
        endTime: string;
      }> = [];

      for (const affected of affectedSessions) {
        const sessionDate =
          targetWeekday !== null
            ? sessionDateOnWeekdayInSameWeek(affected.sessionDate, targetWeekday)
            : affected.sessionDate;

        const endTime =
          newEndTime ??
          addMinutesToTime(newStartTime, schedule.durationMinutes);

        plannedUpdates.push({
          id: affected.id,
          sessionDate,
          startTime: newStartTime,
          endTime,
        });
      }

      for (const planned of plannedUpdates) {
        const conflictError = await validateSessionSlot({
          groupId: existing.groupId,
          groupName: existing.group.name,
          sessionDate: planned.sessionDate,
          startTime: planned.startTime,
          endTime: planned.endTime,
          coachId: payload.coachId !== undefined ? payload.coachId : existing.coachId,
          room: payload.room !== undefined ? payload.room : existing.room,
          excludeIds: affectedIds,
          groupSportId: existing.group.sportId,
        });

        if (conflictError) {
          return NextResponse.json(
            {
              error: `Conflit le ${formatSessionSlotLabel(planned.sessionDate, planned.startTime)} : ${conflictError}`,
            },
            { status: 409 },
          );
        }
      }

      const scheduleUpdate: Prisma.GroupScheduleUpdateInput = {};
      if (payload.startTime !== undefined) scheduleUpdate.startTime = payload.startTime;
      if (targetWeekday !== null && nextSessionDate) {
        scheduleUpdate.dayOfWeek = dayOfWeekEnumFromDate(nextSessionDate);
      }

      const ops: Prisma.PrismaPromise<unknown>[] = [];

      if (Object.keys(scheduleUpdate).length > 0) {
        ops.push(
          prisma.groupSchedule.update({
            where: { id: existing.scheduleId },
            data: scheduleUpdate,
          }),
        );
      }

      for (const planned of plannedUpdates) {
        ops.push(
          prisma.session.update({
            where: { id: planned.id },
            data: {
              sessionDate: planned.sessionDate,
              startTime: planned.startTime,
              endTime: planned.endTime,
              ...(payload.coachId !== undefined ? { coachId: payload.coachId } : {}),
              ...(payload.room !== undefined ? { room: payload.room } : {}),
              ...(payload.status !== undefined ? { status: payload.status } : {}),
              ...(payload.exceptionReason !== undefined ? { exceptionReason: payload.exceptionReason } : {}),
            },
          }),
        );
      }

      const details = eligibility?.ok
        ? coachSportOverrideAuditDetails(eligibility, {
            sessionId: id,
            groupId: existing.groupId,
            groupName: existing.group.name,
            operation: "SESSION_UPDATE_PERMANENT",
          })
        : null;
      const editedPlan = plannedUpdates.find((planned) => planned.id === id) ?? plannedUpdates[0];
      const beforeSnapshot = sessionAuditSnapshot(existing);
      const requestedSnapshot = {
        ...beforeSnapshot,
        sessionDate: (editedPlan?.sessionDate ?? targetDate).toISOString(),
        startTime: editedPlan?.startTime ?? targetStartTime,
        endTime: editedPlan?.endTime ?? targetEndTime,
        coachId: payload.coachId !== undefined ? payload.coachId : existing.coachId,
        room: payload.room !== undefined ? payload.room : existing.room,
        status: payload.status ?? existing.status,
        exceptionReason: payload.exceptionReason ?? existing.exceptionReason,
      };
      const changedFields = changedSessionFields(beforeSnapshot, requestedSnapshot);

      ops.push(
        prisma.auditLog.create({
          data: {
            tenantId: actor.tenantId,
            action: "SESSION_UPDATED",
            entityType: "Session",
            entityId: id,
            userId: actor.id,
            details: JSON.stringify({
              tenantId: actor.tenantId,
              mode: "permanent",
              affectedSessionIds: affectedIds,
              affectedCount: affectedIds.length,
              scheduleId: existing.scheduleId,
              reason: changeReason,
              changedFields,
              before: beforeSnapshot,
              requested: requestedSnapshot,
            }),
          },
        }),
      );

      if (details) {
        ops.push(
          prisma.auditLog.create({
            data: {
              tenantId: actor.tenantId,
              action: "COACH_SPORT_OVERRIDE_USED",
              entityType: "Session",
              entityId: id,
              userId: actor.id,
              details,
            },
          }),
        );
      }

      await prisma.$transaction(ops);

      const updated = await prisma.session.findFirst({
        where: { id, tenantId: actor.tenantId },
        include: {
          group: { select: { name: true, sportId: true } },
          coach: { select: { firstName: true, lastName: true } },
        },
      });

      if (!updated) {
        return NextResponse.json({ error: "Séance introuvable après mise à jour" }, { status: 500 });
      }

      return NextResponse.json({ data: sessionResponsePayload(updated) });
    }

    // Exception mode or no schedule — just update this session
    try {
      await assertNoAttendancesForSessionEdit(id, actor.tenantId);
    } catch (error) {
      if (error instanceof SessionEditBlockedError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }

    const details = eligibility?.ok
      ? coachSportOverrideAuditDetails(eligibility, {
          sessionId: id,
          groupId: existing.groupId,
          groupName: existing.group.name,
          operation: "SESSION_UPDATE_EXCEPTION",
        })
      : null;

    const beforeSnapshot = sessionAuditSnapshot(existing);
    const updated = await prisma.$transaction(async (tx) => {
      const updatedSession = await tx.session.update({
        where: { id },
        data: sessionData,
        include: {
          group: { select: { name: true, sportId: true } },
          coach: { select: { firstName: true, lastName: true } },
        },
      });
      const afterSnapshot = sessionAuditSnapshot(updatedSession);

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "SESSION_UPDATED",
          entityType: "Session",
          entityId: id,
          userId: actor.id,
          details: JSON.stringify({
            tenantId: actor.tenantId,
            mode: "exception",
            changedFields: changedSessionFields(beforeSnapshot, afterSnapshot),
            before: beforeSnapshot,
            after: afterSnapshot,
          }),
        },
      });

      if (details) {
        await tx.auditLog.create({
          data: {
            tenantId: actor.tenantId,
            action: "COACH_SPORT_OVERRIDE_USED",
            entityType: "Session",
            entityId: id,
            userId: actor.id,
            details,
          },
        });
      }

      return updatedSession;
    });

    return NextResponse.json({ data: sessionResponsePayload(updated) });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2002")) {
      return NextResponse.json(
        { error: "Conflit de créneau sur une ou plusieurs séances" },
        { status: 409 },
      );
    }
    if (isPrismaErrorCode(error, "P2025")) {
      return NextResponse.json({ error: "Séance ou planning introuvable" }, { status: 404 });
    }

    console.error("[sessions PATCH]", error);
    return NextResponse.json({ error: "Erreur serveur lors de la mise à jour" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let actor;
  try {
    actor = await requirePermission(request, "class.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const { id } = await params;

  const existing = await prisma.session.findFirst({
    where: { id, tenantId: actor.tenantId },
    select: { id: true, status: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }

  if (existing.status === "COMPLETED") {
    return NextResponse.json(
      { error: "Cette séance est finalisée. Rouvrez-la avant de l'annuler." },
      { status: 409 },
    );
  }

  try {
    await assertNoAttendancesForSessionEdit(id, actor.tenantId);
  } catch (error) {
    if (error instanceof SessionEditBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  const cancelled = await prisma.$transaction(async (tx) => {
    const updated = await tx.session.update({
      where: { id },
      data: {
        status: "CANCELLED",
        exceptionReason: "Annulation depuis le planning",
        postponedTo: null,
        postponementReason: null,
        postponementDetails: null,
      },
      select: { id: true, status: true, exceptionReason: true, updatedAt: true },
    });

    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        action: "SESSION_CANCELLED",
        entityType: "Session",
        entityId: id,
        userId: actor.id,
        details: JSON.stringify({
          tenantId: actor.tenantId,
          previous: existing,
          next: updated,
          reason: "Annulation depuis le planning",
        }),
      },
    });

    return updated;
  });

  return NextResponse.json({ data: cancelled });
}
