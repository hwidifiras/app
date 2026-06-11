import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { getAppTimeZone, utcDateOnlyForTimeZone } from "@/lib/dates";
import { postponeSessionSchema } from "@/lib/schemas/session";
import { validateSessionSlot } from "@/lib/session-slot-conflict";

export const runtime = "nodejs";

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map((value) => Number(value));
  return hours * 60 + minutes;
}

function minutesDiff(startTime: string, endTime: string): number {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const diff = end - start;
  if (diff > 0) return diff;
  return 60;
}

function toTimeString(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";

  return `${hour}:${minute}`;
}

function addMinutesToTime(startTime: string, durationMinutes: number) {
  const [hours, minutes] = startTime.split(":").map((value) => Number(value));
  const total = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor((total % (24 * 60)) / 60);
  const endMinutes = total % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

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

  const parsed = postponeSessionSchema.safeParse(body);

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
      sessionDate: true,
      startTime: true,
      endTime: true,
      coachId: true,
      room: true,
      postponementDetails: true,
      status: true,
      group: { select: { name: true, coachId: true } },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
  }

  if (existing.status === "CANCELLED") {
    return NextResponse.json(
      { error: "Impossible de reporter une séance annulée" },
      { status: 409 },
    );
  }

  if (existing.status === "COMPLETED") {
    return NextResponse.json(
      { error: "Impossible de reporter une séance déjà terminée" },
      { status: 409 },
    );
  }

  const attendanceCount = await prisma.attendance.count({ where: { sessionId: id } });
  if (attendanceCount > 0) {
    return NextResponse.json(
      {
        error:
          "Impossible de reporter une séance avec des pointages enregistrés. Annulez les présences avant de reporter.",
      },
      { status: 409 },
    );
  }

  const postponementDate = new Date(parsed.data.postponedTo);
  if (Number.isNaN(postponementDate.getTime())) {
    return NextResponse.json({ error: "Date de report invalide" }, { status: 400 });
  }

  const timeZone = getAppTimeZone();
  const newSessionDate = utcDateOnlyForTimeZone(postponementDate, timeZone);
  const newStartTime = toTimeString(postponementDate, timeZone);
  const duration = minutesDiff(existing.startTime, existing.endTime);
  const newEndTime = addMinutesToTime(newStartTime, duration);

  const conflictError = await validateSessionSlot({
    groupId: existing.groupId,
    groupName: existing.group.name,
    sessionDate: newSessionDate,
    startTime: newStartTime,
    endTime: newEndTime,
    coachId: existing.coachId ?? existing.group.coachId,
    room: existing.room,
    excludeIds: [id],
  });

  if (conflictError) {
    return NextResponse.json({ error: conflictError }, { status: 409 });
  }

  let originalInfo = {
    date: existing.sessionDate.toISOString(),
    startTime: existing.startTime,
    endTime: existing.endTime,
  };

  if (existing.postponementDetails) {
    try {
      const parsedDetails = JSON.parse(existing.postponementDetails) as {
        original?: { date?: string; startTime?: string; endTime?: string };
      };
      if (parsedDetails?.original?.date && parsedDetails?.original?.startTime && parsedDetails?.original?.endTime) {
        originalInfo = {
          date: parsedDetails.original.date,
          startTime: parsedDetails.original.startTime,
          endTime: parsedDetails.original.endTime,
        };
      }
    } catch {
      // Ignore invalid JSON and keep current session as original.
    }
  }

  const postponementPayload = {
    original: originalInfo,
    postponedTo: postponementDate.toISOString(),
    postponedAt: new Date().toISOString(),
    reason: parsed.data.reason,
    notes: parsed.data.details?.trim() || null,
  };

  const updated = await prisma.session.update({
    where: { id },
    data: {
      sessionDate: newSessionDate,
      startTime: newStartTime,
      endTime: newEndTime,
      status: "RESCHEDULED",
      postponedTo: postponementDate,
      postponementReason: parsed.data.reason,
      postponementDetails: JSON.stringify(postponementPayload),
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "SESSION_POSTPONED",
      entityType: "Session",
      entityId: updated.id,
      userId: actor?.id ?? null,
      details: JSON.stringify({
        fromDate: originalInfo.date,
        fromTime: originalInfo.startTime,
        toDate: updated.sessionDate.toISOString(),
        toTime: updated.startTime,
        reason: updated.postponementReason,
      }),
    },
  });

  return NextResponse.json({
    data: {
      id: updated.id,
      sessionDate: updated.sessionDate.toISOString(),
      startTime: updated.startTime,
      endTime: updated.endTime,
      status: updated.status,
      postponedTo: updated.postponedTo?.toISOString() ?? null,
      postponementReason: updated.postponementReason,
      postponementDetails: updated.postponementDetails,
    },
  });
}
