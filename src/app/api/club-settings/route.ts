import { NextResponse } from "next/server";

import { getClubSettings, writeClubLogoUrl } from "@/lib/club-settings";
import { CLUB_DAY_LABELS, DAY_INDEX_TO_CLUB_DAY, WORKING_DAY_ORDER, type ClubDay } from "@/lib/club-working-days";
import { utcDateOnlyForTimeZone } from "@/lib/dates";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { updateClubSettingsSchema } from "@/lib/schemas/club-settings";
import { requireAuth } from "@/lib/request-user";

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
    allowPublicRegister: settings.allowPublicRegister,
    workingDays: settings.workingDays,
    maxStaffDiscountPercent: settings.maxStaffDiscountPercent,
    debtAlertThresholdCents: settings.debtAlertThresholdCents,
    dashboardDefaultMode: settings.dashboardDefaultMode,
    dashboardShowTodaySessions: settings.dashboardShowTodaySessions,
    dashboardShowCashToday: settings.dashboardShowCashToday,
    dashboardShowDataConfidence: settings.dashboardShowDataConfidence,
    dashboardShowCashTrend: settings.dashboardShowCashTrend,
    dashboardShowMembersOverview: settings.dashboardShowMembersOverview,
    dashboardShowCommercialInsights: settings.dashboardShowCommercialInsights,
    dashboardShowDetailedDebts: settings.dashboardShowDetailedDebts,
    dashboardShowGymOverview: settings.dashboardShowGymOverview,
    gymAllowCheckInWithPartialPayment: settings.gymAllowCheckInWithPartialPayment,
    gymDuplicateScanWindowMinutes: settings.gymDuplicateScanWindowMinutes,
    gymDailyVisitLimit: settings.gymDailyVisitLimit,
    gymAllowExceptionalAccess: settings.gymAllowExceptionalAccess,
    gymEnforceOpeningHours: settings.gymEnforceOpeningHours,
    gymOpeningHours: settings.gymOpeningHours,
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

async function findWorkingDayClosureBlockers(tenantId: string, removedDays: ClubDay[]): Promise<ClosureBlocker[]> {
  if (removedDays.length === 0) return [];

  const removed = new Set<ClubDay>(removedDays);
  const today = utcDateOnlyForTimeZone(new Date());

  const [sessions, schedules] = await Promise.all([
    prisma.session.findMany({
      where: {
        tenantId,
        sessionDate: { gte: today },
        status: { not: "CANCELLED" },
      },
      select: { sessionDate: true },
    }),
    prisma.groupSchedule.findMany({
      where: {
        tenantId,
        dayOfWeek: { in: removedDays },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
        group: { tenantId, isActive: true },
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
    admin = await requirePermission(request, "settings.manage");
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

  const nextGymEnforceOpeningHours = data.gymEnforceOpeningHours ?? before.gymEnforceOpeningHours;
  const nextGymOpeningHours = data.gymOpeningHours ?? before.gymOpeningHours;
  if (nextGymEnforceOpeningHours && nextGymOpeningHours.length === 0) {
    return NextResponse.json(
      { error: "Ajoutez au moins un créneau d'ouverture avant d'activer le contrôle des horaires." },
      { status: 400 },
    );
  }

  if (data.workingDays !== undefined) {
    const nextWorkingDays = new Set(data.workingDays);
    const removedDays = before.workingDays.filter((day) => !nextWorkingDays.has(day));
    const blockers = await findWorkingDayClosureBlockers(admin.tenantId, removedDays);
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
    where: { tenantId: admin.tenantId },
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
      ...(data.allowPublicRegister !== undefined ? { allowPublicRegister: data.allowPublicRegister } : {}),
      ...(data.workingDays !== undefined ? { workingDays: data.workingDays } : {}),
      ...(data.maxStaffDiscountPercent !== undefined
        ? { maxStaffDiscountPercent: data.maxStaffDiscountPercent }
        : {}),
      ...(data.debtAlertThresholdCents !== undefined
        ? { debtAlertThresholdCents: data.debtAlertThresholdCents }
        : {}),
      ...(data.dashboardDefaultMode !== undefined ? { dashboardDefaultMode: data.dashboardDefaultMode } : {}),
      ...(data.dashboardShowTodaySessions !== undefined
        ? { dashboardShowTodaySessions: data.dashboardShowTodaySessions }
        : {}),
      ...(data.dashboardShowCashToday !== undefined ? { dashboardShowCashToday: data.dashboardShowCashToday } : {}),
      ...(data.dashboardShowDataConfidence !== undefined
        ? { dashboardShowDataConfidence: data.dashboardShowDataConfidence }
        : {}),
      ...(data.dashboardShowCashTrend !== undefined ? { dashboardShowCashTrend: data.dashboardShowCashTrend } : {}),
      ...(data.dashboardShowMembersOverview !== undefined
        ? { dashboardShowMembersOverview: data.dashboardShowMembersOverview }
        : {}),
      ...(data.dashboardShowCommercialInsights !== undefined
        ? { dashboardShowCommercialInsights: data.dashboardShowCommercialInsights }
        : {}),
      ...(data.dashboardShowDetailedDebts !== undefined
        ? { dashboardShowDetailedDebts: data.dashboardShowDetailedDebts }
        : {}),
      ...(data.dashboardShowGymOverview !== undefined
        ? { dashboardShowGymOverview: data.dashboardShowGymOverview }
        : {}),
      ...(data.gymAllowCheckInWithPartialPayment !== undefined
        ? { gymAllowCheckInWithPartialPayment: data.gymAllowCheckInWithPartialPayment }
        : {}),
      ...(data.gymDuplicateScanWindowMinutes !== undefined
        ? { gymDuplicateScanWindowMinutes: data.gymDuplicateScanWindowMinutes }
        : {}),
      ...(data.gymDailyVisitLimit !== undefined ? { gymDailyVisitLimit: data.gymDailyVisitLimit } : {}),
      ...(data.gymAllowExceptionalAccess !== undefined
        ? { gymAllowExceptionalAccess: data.gymAllowExceptionalAccess }
        : {}),
      ...(data.gymEnforceOpeningHours !== undefined
        ? { gymEnforceOpeningHours: data.gymEnforceOpeningHours }
        : {}),
      ...(data.gymOpeningHours !== undefined ? { gymOpeningHours: data.gymOpeningHours } : {}),
      ...(data.receiptPrefix !== undefined ? { receiptPrefix: data.receiptPrefix.toUpperCase() } : {}),
      ...(data.nextReceiptSequence !== undefined ? { nextReceiptSequence: data.nextReceiptSequence } : {}),
      ...(data.receiptFooter !== undefined ? { receiptFooter: data.receiptFooter } : {}),
      ...(data.receiptEmailDefault !== undefined ? { receiptEmailDefault: data.receiptEmailDefault } : {}),
      ...(data.receiptPrintDefault !== undefined ? { receiptPrintDefault: data.receiptPrintDefault } : {}),
    },
  });
  const after = await getClubSettings();

  await prisma.auditLog.create({
    data: {
      tenantId: admin.tenantId,
      action: "CLUB_SETTINGS_UPDATED",
      entityType: "ClubSettings",
      entityId: updated.id,
      userId: admin.id,
      details: JSON.stringify({
        tenantId: admin.tenantId,
        before: serializeSettings(before),
        after: serializeSettings(after),
      }),
    },
  });

  return NextResponse.json({ data: serializeSettings(after) });
}
