import { NextResponse } from "next/server";

import { getClubSettings, writeClubLogoUrl } from "@/lib/club-settings";
import { CLUB_DAY_LABELS, DAY_INDEX_TO_CLUB_DAY, WORKING_DAY_ORDER, type ClubDay } from "@/lib/club-working-days";
import { utcDateOnlyForTimeZone } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { updateClubSettingsSchema } from "@/lib/schemas/club-settings";
import { requireAdmin, requireAuth } from "@/lib/request-user";

export const runtime = "nodejs";

function serializeSettings(settings: Awaited<ReturnType<typeof getClubSettings>>) {
  return {
    clubName: settings.clubName,
    clubLogoUrl: settings.clubLogoUrl ?? "",
    clubAddress: settings.clubAddress,
    clubPhone: settings.clubPhone,
    receiptLegalName: settings.receiptLegalName,
    receiptTaxId: settings.receiptTaxId,
    allowCheckInWithPartialPayment: settings.allowCheckInWithPartialPayment,
    allowCheckInWithoutSubscription: settings.allowCheckInWithoutSubscription,
    absentConsumesSession: settings.absentConsumesSession,
    allowSameRoomConcurrentGroups: settings.allowSameRoomConcurrentGroups,
    allowCoachConcurrentSameRoomQualified: settings.allowCoachConcurrentSameRoomQualified,
    workingDays: settings.workingDays,
    maxStaffDiscountPercent: settings.maxStaffDiscountPercent,
    debtAlertThresholdCents: settings.debtAlertThresholdCents,
    receiptPrefix: settings.receiptPrefix,
    nextReceiptSequence: settings.nextReceiptSequence,
    receiptFooter: settings.receiptFooter,
    receiptEmailDefault: settings.receiptEmailDefault,
    receiptPrintDefault: settings.receiptPrintDefault,
    updatedAt: settings.updatedAt.toISOString(),
  };
}

type ClosureBlocker = {
  day: ClubDay;
  sessionCount: number;
  scheduleCount: number;
};

async function findWorkingDayClosureBlockers(removedDays: ClubDay[]): Promise<ClosureBlocker[]> {
  if (removedDays.length === 0) return [];

  const removed = new Set<ClubDay>(removedDays);
  const today = utcDateOnlyForTimeZone(new Date());

  const [sessions, schedules] = await Promise.all([
    prisma.session.findMany({
      where: {
        sessionDate: { gte: today },
        status: { not: "CANCELLED" },
      },
      select: { sessionDate: true },
    }),
    prisma.groupSchedule.findMany({
      where: {
        dayOfWeek: { in: removedDays },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
        group: { isActive: true },
      },
      select: { dayOfWeek: true },
    }),
  ]);

  const blockers = new Map<ClubDay, ClosureBlocker>();
  for (const day of removedDays) {
    blockers.set(day, { day, sessionCount: 0, scheduleCount: 0 });
  }

  for (const session of sessions) {
    const day = DAY_INDEX_TO_CLUB_DAY[session.sessionDate.getUTCDay()];
    if (!removed.has(day)) continue;
    const blocker = blockers.get(day);
    if (blocker) blocker.sessionCount += 1;
  }

  for (const schedule of schedules) {
    const blocker = blockers.get(schedule.dayOfWeek);
    if (blocker) blocker.scheduleCount += 1;
  }

  return WORKING_DAY_ORDER
    .filter((day) => removed.has(day))
    .map((day) => blockers.get(day))
    .filter((blocker): blocker is ClosureBlocker => Boolean(blocker && (blocker.sessionCount > 0 || blocker.scheduleCount > 0)));
}

function formatWorkingDayClosureDetails(blockers: ClosureBlocker[]) {
  return blockers.map((blocker) => {
    const parts = [];
    if (blocker.sessionCount > 0) {
      parts.push(`${blocker.sessionCount} seance${blocker.sessionCount > 1 ? "s" : ""} planifiee${blocker.sessionCount > 1 ? "s" : ""}`);
    }
    if (blocker.scheduleCount > 0) {
      parts.push(`${blocker.scheduleCount} horaire${blocker.scheduleCount > 1 ? "s" : ""} actif${blocker.scheduleCount > 1 ? "s" : ""}`);
    }
    return `${CLUB_DAY_LABELS[blocker.day]}: ${parts.join(", ")}`;
  });
}

export async function GET(request: Request) {
  try {
    await requireAuth(request);
  } catch (e) {
    const code = e instanceof Error ? e.message : "FORBIDDEN";
    return NextResponse.json(
      { error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé" },
      { status: code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }

  const settings = await getClubSettings();
  return NextResponse.json({ data: serializeSettings(settings) });
}

export async function PATCH(request: Request) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch (e) {
    const code = e instanceof Error ? e.message : "FORBIDDEN";
    return NextResponse.json(
      { error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé" },
      { status: code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = updateClubSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation échouée", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const before = await getClubSettings();

  if (data.workingDays !== undefined) {
    const nextWorkingDays = new Set(data.workingDays);
    const removedDays = before.workingDays.filter((day) => !nextWorkingDays.has(day));
    const blockers = await findWorkingDayClosureBlockers(removedDays);
    if (blockers.length > 0) {
      return NextResponse.json(
        {
          error: "Impossible de fermer ce jour: des seances ou horaires sont deja reserves.",
          details: {
            blockedDays: blockers.map((blocker) => blocker.day),
            workingDays: formatWorkingDayClosureDetails(blockers),
          },
        },
        { status: 409 },
      );
    }
  }

  if (data.clubLogoUrl !== undefined) {
    await writeClubLogoUrl(data.clubLogoUrl);
  }

  const updated = await prisma.clubSettings.update({
    where: { id: before.id },
    data: {
      ...(data.clubName !== undefined ? { clubName: data.clubName } : {}),
      ...(data.clubAddress !== undefined ? { clubAddress: data.clubAddress } : {}),
      ...(data.clubPhone !== undefined ? { clubPhone: data.clubPhone } : {}),
      ...(data.receiptLegalName !== undefined ? { receiptLegalName: data.receiptLegalName } : {}),
      ...(data.receiptTaxId !== undefined ? { receiptTaxId: data.receiptTaxId } : {}),
      ...(data.allowCheckInWithPartialPayment !== undefined
        ? { allowCheckInWithPartialPayment: data.allowCheckInWithPartialPayment }
        : {}),
      ...(data.allowCheckInWithoutSubscription !== undefined
        ? { allowCheckInWithoutSubscription: data.allowCheckInWithoutSubscription }
        : {}),
      ...(data.absentConsumesSession !== undefined ? { absentConsumesSession: data.absentConsumesSession } : {}),
      ...(data.allowSameRoomConcurrentGroups !== undefined
        ? { allowSameRoomConcurrentGroups: data.allowSameRoomConcurrentGroups }
        : {}),
      ...(data.allowCoachConcurrentSameRoomQualified !== undefined
        ? { allowCoachConcurrentSameRoomQualified: data.allowCoachConcurrentSameRoomQualified }
        : {}),
      ...(data.workingDays !== undefined ? { workingDays: data.workingDays } : {}),
      ...(data.maxStaffDiscountPercent !== undefined
        ? { maxStaffDiscountPercent: data.maxStaffDiscountPercent }
        : {}),
      ...(data.debtAlertThresholdCents !== undefined
        ? { debtAlertThresholdCents: data.debtAlertThresholdCents }
        : {}),
      ...(data.receiptPrefix !== undefined ? { receiptPrefix: data.receiptPrefix.toUpperCase() } : {}),
      ...(data.nextReceiptSequence !== undefined ? { nextReceiptSequence: data.nextReceiptSequence } : {}),
      ...(data.receiptFooter !== undefined ? { receiptFooter: data.receiptFooter } : {}),
      ...(data.receiptEmailDefault !== undefined ? { receiptEmailDefault: data.receiptEmailDefault } : {}),
      ...(data.receiptPrintDefault !== undefined ? { receiptPrintDefault: data.receiptPrintDefault } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "CLUB_SETTINGS_UPDATED",
      entityType: "ClubSettings",
      entityId: updated.id,
      userId: admin.id,
      details: JSON.stringify({
        before: serializeSettings(before),
        after: serializeSettings(updated),
      }),
    },
  });

  const settings = await getClubSettings();
  return NextResponse.json({ data: serializeSettings(settings) });
}
