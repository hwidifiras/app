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
import { requireAuth } from "@/lib/request-user";
import {
  buildSessionSlotConflictMessage,
  findSessionSlotConflict,
  formatSessionSlotLabel,
} from "@/lib/session-slot-conflict";

export const runtime = "nodejs";

function addMinutesToTime(startTime: string, durationMinutes: number) {
  const [hours, minutes] = startTime.split(":").map((value) => Number(value));
  const total = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor((total % (24 * 60)) / 60);
  const endMinutes = total % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(_request);
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      group: { select: { name: true } },
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

  return NextResponse.json({
    data: {
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
      postponedTo: session.postponedTo ? session.postponedTo.toISOString() : null,
      postponementReason: session.postponementReason,
      postponementDetails: session.postponementDetails,
      schedule: session.schedule,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
  });
}

function sessionResponsePayload(
  updated: {
    id: string;
    groupId: string;
    scheduleId: string | null;
    sessionDate: Date;
    startTime: string;
    endTime: string;
    coachId: string | null;
    room: string;
    status: string;
    exceptionReason: string | null;
    postponedTo: Date | null;
    postponementReason: string | null;
    postponementDetails: string | null;
    createdAt: Date;
    updatedAt: Date;
    group: { name: string };
    coach: { firstName: string; lastName: string } | null;
  },
) {
  return {
    id: updated.id,
    groupId: updated.groupId,
    groupName: updated.group.name,
    scheduleId: updated.scheduleId,
    sessionDate: updated.sessionDate.toISOString(),
    startTime: updated.startTime,
    endTime: updated.endTime,
    coachId: updated.coachId,
    coachName: updated.coach ? `${updated.coach.firstName} ${updated.coach.lastName}` : null,
    room: updated.room,
    status: updated.status,
    exceptionReason: updated.exceptionReason,
    postponedTo: updated.postponedTo ? updated.postponedTo.toISOString() : null,
    postponementReason: updated.postponementReason,
    postponementDetails: updated.postponementDetails,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
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

  const existing = await prisma.session.findUnique({
    where: { id },
    select: {
      id: true,
      groupId: true,
      scheduleId: true,
      sessionDate: true,
      startTime: true,
      status: true,
      group: { select: { name: true } },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }

  const payload = parsed.data;
  const isPermanent = editMode === "permanent";

  if (isPermanent && !existing.scheduleId) {
    return NextResponse.json(
      {
        error:
          "Cette séance n'est pas liée à un créneau récurrent. Utilisez le mode Exception pour modifier cette séance seule.",
      },
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
  const dateChanged = nextSessionDate !== undefined && nextSessionDate.getTime() !== existingDateOnly.getTime();
  const timeChanged = payload.startTime !== undefined && payload.startTime !== existing.startTime;

  if (dateChanged || timeChanged) {
    const conflict = await findSessionSlotConflict({
      groupId: existing.groupId,
      sessionDate: targetDate,
      startTime: targetStartTime,
      excludeIds: [id],
    });

    if (conflict) {
      return NextResponse.json(
        {
          error: buildSessionSlotConflictMessage(existing.group.name, targetDate, targetStartTime),
        },
        { status: 409 },
      );
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
      const schedule = await prisma.groupSchedule.findUnique({
        where: { id: existing.scheduleId },
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
          scheduleId: existing.scheduleId,
          sessionDate: { gte: existing.sessionDate },
        },
        select: { id: true, sessionDate: true },
        orderBy: { sessionDate: "asc" },
      });

      const affectedIds = affectedSessions.map((s) => s.id);
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
        const conflict = await findSessionSlotConflict({
          groupId: existing.groupId,
          sessionDate: planned.sessionDate,
          startTime: planned.startTime,
          excludeIds: affectedIds,
        });

        if (conflict) {
          return NextResponse.json(
            {
              error: `Conflit le ${formatSessionSlotLabel(planned.sessionDate, planned.startTime)} : une autre séance du groupe « ${existing.group.name} » occupe déjà ce créneau.`,
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

      await prisma.$transaction(ops);

      const updated = await prisma.session.findUnique({
        where: { id },
        include: {
          group: { select: { name: true } },
          coach: { select: { firstName: true, lastName: true } },
        },
      });

      if (!updated) {
        return NextResponse.json({ error: "Séance introuvable après mise à jour" }, { status: 500 });
      }

      return NextResponse.json({ data: sessionResponsePayload(updated) });
    }

    // Exception mode or no schedule — just update this session
    const updated = await prisma.session.update({
      where: { id },
      data: sessionData,
      include: {
        group: { select: { name: true } },
        coach: { select: { firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({ data: sessionResponsePayload(updated) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { error: "Conflit de créneau sur une ou plusieurs séances" },
          { status: 409 },
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Séance ou planning introuvable" }, { status: 404 });
      }
    }

    console.error("[sessions PATCH]", error);
    return NextResponse.json({ error: "Erreur serveur lors de la mise à jour" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(_request);
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;

  const existing = await prisma.session.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }

  await prisma.session.delete({
    where: { id },
  });

  return NextResponse.json({ data: { deleted: true } });
}
