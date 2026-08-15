import { prisma } from "@/lib/prisma";
import { DEFAULT_WORKING_DAYS, normalizeWorkingDays, type ClubDay } from "@/lib/club-working-days";
import { normalizeDashboardDefaultMode, type DashboardDefaultMode } from "@/lib/dashboard-preferences";
import { getTenantContext, getTenantId, withTenantContext } from "@/lib/tenant-context";
import { normalizeGymOpeningHours, type GymOpeningWindow } from "@/modules/gym/opening-hours";

export type ClubSettingsData = {
  id: string;
  clubName: string;
  clubLogoUrl: string;
  clubAddress: string;
  clubPhone: string;
  receiptLegalName: string;
  receiptTaxId: string;
  allowCheckInWithPartialPayment: boolean;
  allowCheckInWithoutSubscription: boolean;
  absentConsumesSession: boolean;
  allowSameRoomConcurrentGroups: boolean;
  allowCoachConcurrentSameRoomQualified: boolean;
  allowPublicRegister: boolean;
  workingDays: ClubDay[];
  maxStaffDiscountPercent: number;
  debtAlertThresholdCents: number;
  dashboardDefaultMode: DashboardDefaultMode;
  dashboardShowTodaySessions: boolean;
  dashboardShowCashToday: boolean;
  dashboardShowDataConfidence: boolean;
  dashboardShowCashTrend: boolean;
  dashboardShowMembersOverview: boolean;
  dashboardShowCommercialInsights: boolean;
  dashboardShowDetailedDebts: boolean;
  dashboardShowGymOverview: boolean;
  gymAllowCheckInWithPartialPayment: boolean;
  gymDuplicateScanWindowMinutes: number;
  gymDailyVisitLimit: number | null;
  gymAllowExceptionalAccess: boolean;
  gymEnforceOpeningHours: boolean;
  gymOpeningHours: GymOpeningWindow[];
  receiptPrefix: string;
  nextReceiptSequence: number;
  receiptFooter: string;
  receiptEmailDefault: boolean;
  receiptPrintDefault: boolean;
  updatedAt: Date;
};

const DEFAULTS = {
  id: "default",
  clubName: "",
  clubLogoUrl: "",
  clubAddress: "",
  clubPhone: "",
  receiptLegalName: "",
  receiptTaxId: "",
  allowCheckInWithPartialPayment: true,
  allowCheckInWithoutSubscription: false,
  absentConsumesSession: true,
  allowSameRoomConcurrentGroups: false,
  allowCoachConcurrentSameRoomQualified: false,
  allowPublicRegister: false,
  workingDays: [...DEFAULT_WORKING_DAYS],
  maxStaffDiscountPercent: 30,
  debtAlertThresholdCents: 0,
  dashboardDefaultMode: "AUTO" as DashboardDefaultMode,
  dashboardShowTodaySessions: true,
  dashboardShowCashToday: true,
  dashboardShowDataConfidence: true,
  dashboardShowCashTrend: true,
  dashboardShowMembersOverview: true,
  dashboardShowCommercialInsights: true,
  dashboardShowDetailedDebts: true,
  dashboardShowGymOverview: true,
  gymAllowCheckInWithPartialPayment: true,
  gymDuplicateScanWindowMinutes: 2,
  gymDailyVisitLimit: null,
  gymAllowExceptionalAccess: true,
  gymEnforceOpeningHours: false,
  gymOpeningHours: [] as GymOpeningWindow[],
  receiptPrefix: "WD",
  nextReceiptSequence: 1,
  receiptFooter: "",
  receiptEmailDefault: false,
  receiptPrintDefault: true,
} as const;

function normalizeClubSettings(row: Record<string, unknown>): ClubSettingsData {
  return {
    id: typeof row.id === "string" ? row.id : DEFAULTS.id,
    clubName: typeof row.clubName === "string" ? row.clubName : DEFAULTS.clubName,
    clubLogoUrl: typeof row.clubLogoUrl === "string" ? row.clubLogoUrl : DEFAULTS.clubLogoUrl,
    clubAddress: typeof row.clubAddress === "string" ? row.clubAddress : DEFAULTS.clubAddress,
    clubPhone: typeof row.clubPhone === "string" ? row.clubPhone : DEFAULTS.clubPhone,
    receiptLegalName: typeof row.receiptLegalName === "string" ? row.receiptLegalName : DEFAULTS.receiptLegalName,
    receiptTaxId: typeof row.receiptTaxId === "string" ? row.receiptTaxId : DEFAULTS.receiptTaxId,
    allowCheckInWithPartialPayment:
      typeof row.allowCheckInWithPartialPayment === "boolean"
        ? row.allowCheckInWithPartialPayment
        : DEFAULTS.allowCheckInWithPartialPayment,
    allowCheckInWithoutSubscription:
      typeof row.allowCheckInWithoutSubscription === "boolean"
        ? row.allowCheckInWithoutSubscription
        : DEFAULTS.allowCheckInWithoutSubscription,
    absentConsumesSession:
      typeof row.absentConsumesSession === "boolean"
        ? row.absentConsumesSession
        : DEFAULTS.absentConsumesSession,
    allowSameRoomConcurrentGroups:
      typeof row.allowSameRoomConcurrentGroups === "boolean"
        ? row.allowSameRoomConcurrentGroups
        : DEFAULTS.allowSameRoomConcurrentGroups,
    allowCoachConcurrentSameRoomQualified:
      typeof row.allowCoachConcurrentSameRoomQualified === "boolean"
        ? row.allowCoachConcurrentSameRoomQualified
        : DEFAULTS.allowCoachConcurrentSameRoomQualified,
    allowPublicRegister:
      typeof row.allowPublicRegister === "boolean" ? row.allowPublicRegister : DEFAULTS.allowPublicRegister,
    workingDays: normalizeWorkingDays(row.workingDays),
    maxStaffDiscountPercent:
      typeof row.maxStaffDiscountPercent === "number"
        ? row.maxStaffDiscountPercent
        : DEFAULTS.maxStaffDiscountPercent,
    debtAlertThresholdCents:
      typeof row.debtAlertThresholdCents === "number"
        ? row.debtAlertThresholdCents
        : DEFAULTS.debtAlertThresholdCents,
    dashboardDefaultMode: normalizeDashboardDefaultMode(row.dashboardDefaultMode),
    dashboardShowTodaySessions:
      typeof row.dashboardShowTodaySessions === "boolean"
        ? row.dashboardShowTodaySessions
        : DEFAULTS.dashboardShowTodaySessions,
    dashboardShowCashToday:
      typeof row.dashboardShowCashToday === "boolean"
        ? row.dashboardShowCashToday
        : DEFAULTS.dashboardShowCashToday,
    dashboardShowDataConfidence:
      typeof row.dashboardShowDataConfidence === "boolean"
        ? row.dashboardShowDataConfidence
        : DEFAULTS.dashboardShowDataConfidence,
    dashboardShowCashTrend:
      typeof row.dashboardShowCashTrend === "boolean"
        ? row.dashboardShowCashTrend
        : DEFAULTS.dashboardShowCashTrend,
    dashboardShowMembersOverview:
      typeof row.dashboardShowMembersOverview === "boolean"
        ? row.dashboardShowMembersOverview
        : DEFAULTS.dashboardShowMembersOverview,
    dashboardShowCommercialInsights:
      typeof row.dashboardShowCommercialInsights === "boolean"
        ? row.dashboardShowCommercialInsights
        : DEFAULTS.dashboardShowCommercialInsights,
    dashboardShowDetailedDebts:
      typeof row.dashboardShowDetailedDebts === "boolean"
        ? row.dashboardShowDetailedDebts
        : DEFAULTS.dashboardShowDetailedDebts,
    dashboardShowGymOverview:
      typeof row.dashboardShowGymOverview === "boolean"
        ? row.dashboardShowGymOverview
        : DEFAULTS.dashboardShowGymOverview,
    gymAllowCheckInWithPartialPayment:
      typeof row.gymAllowCheckInWithPartialPayment === "boolean"
        ? row.gymAllowCheckInWithPartialPayment
        : DEFAULTS.gymAllowCheckInWithPartialPayment,
    gymDuplicateScanWindowMinutes:
      typeof row.gymDuplicateScanWindowMinutes === "number"
        ? row.gymDuplicateScanWindowMinutes
        : DEFAULTS.gymDuplicateScanWindowMinutes,
    gymDailyVisitLimit:
      typeof row.gymDailyVisitLimit === "number" ? row.gymDailyVisitLimit : DEFAULTS.gymDailyVisitLimit,
    gymAllowExceptionalAccess:
      typeof row.gymAllowExceptionalAccess === "boolean"
        ? row.gymAllowExceptionalAccess
        : DEFAULTS.gymAllowExceptionalAccess,
    gymEnforceOpeningHours:
      typeof row.gymEnforceOpeningHours === "boolean"
        ? row.gymEnforceOpeningHours
        : DEFAULTS.gymEnforceOpeningHours,
    gymOpeningHours: normalizeGymOpeningHours(row.gymOpeningHours),
    receiptPrefix: typeof row.receiptPrefix === "string" ? row.receiptPrefix : DEFAULTS.receiptPrefix,
    nextReceiptSequence:
      typeof row.nextReceiptSequence === "number" && row.nextReceiptSequence > 0
        ? row.nextReceiptSequence
        : DEFAULTS.nextReceiptSequence,
    receiptFooter: typeof row.receiptFooter === "string" ? row.receiptFooter : DEFAULTS.receiptFooter,
    receiptEmailDefault:
      typeof row.receiptEmailDefault === "boolean" ? row.receiptEmailDefault : DEFAULTS.receiptEmailDefault,
    receiptPrintDefault:
      typeof row.receiptPrintDefault === "boolean" ? row.receiptPrintDefault : DEFAULTS.receiptPrintDefault,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(),
  };
}

export async function readClubLogoUrl(): Promise<string> {
  const tenantId = getTenantId();
  const row = await prisma.clubSettings.findFirst({
    where: tenantId ? { tenantId } : { tenantId: null },
    select: { clubLogoUrl: true },
  });
  return row?.clubLogoUrl ?? "";
}

export async function writeClubLogoUrl(clubLogoUrl: string): Promise<void> {
  const tenantId = getTenantId();
  const row = await prisma.clubSettings.findFirst({
    where: tenantId ? { tenantId } : { tenantId: null },
    select: { id: true, tenantId: true },
  });

  if (row) {
    await prisma.clubSettings.update({
      where: { id: row.id },
      data: { clubLogoUrl },
    });
    return;
  }

  await prisma.clubSettings.create({ data: { ...(tenantId ? { tenantId } : {}), clubLogoUrl } });
}

export async function getClubSettings(options: { tenantId?: string | null } = {}): Promise<ClubSettingsData> {
  const tenantId = options.tenantId ?? getTenantId();

  if (options.tenantId) {
    const currentContext = getTenantContext();
    return withTenantContext(
      {
        tenantId: options.tenantId,
        tenantSlug: currentContext?.tenantSlug ?? "unknown",
        host: currentContext?.host,
      },
      () => getClubSettings({ tenantId: null }),
    );
  }

  const row = await prisma.clubSettings.findFirst({
    where: tenantId ? { tenantId } : { tenantId: null },
  });
  if (!row) {
    const created = await prisma.clubSettings.create({ data: tenantId ? { tenantId } : {} });
    return normalizeClubSettings(created as Record<string, unknown>);
  }
  return normalizeClubSettings(row as Record<string, unknown>);
}

export { DEFAULTS as CLUB_SETTINGS_DEFAULTS };
