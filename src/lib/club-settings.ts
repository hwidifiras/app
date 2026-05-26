import { prisma } from "@/lib/prisma";

export type ClubSettingsData = {
  id: string;
  clubName: string;
  clubLogoUrl: string;
  clubAddress: string;
  clubPhone: string;
  allowCheckInWithPartialPayment: boolean;
  allowCheckInWithoutSubscription: boolean;
  absentConsumesSession: boolean;
  allowPublicRegister: boolean;
  maxStaffDiscountPercent: number;
  debtAlertThresholdCents: number;
  updatedAt: Date;
};

const DEFAULTS = {
  id: "default",
  clubName: "",
  clubLogoUrl: "",
  clubAddress: "",
  clubPhone: "",
  allowCheckInWithPartialPayment: true,
  allowCheckInWithoutSubscription: false,
  absentConsumesSession: true,
  allowPublicRegister: false,
  maxStaffDiscountPercent: 30,
  debtAlertThresholdCents: 0,
} as const;

function normalizeClubSettings(row: Record<string, unknown>): ClubSettingsData {
  return {
    id: typeof row.id === "string" ? row.id : DEFAULTS.id,
    clubName: typeof row.clubName === "string" ? row.clubName : DEFAULTS.clubName,
    clubLogoUrl: typeof row.clubLogoUrl === "string" ? row.clubLogoUrl : DEFAULTS.clubLogoUrl,
    clubAddress: typeof row.clubAddress === "string" ? row.clubAddress : DEFAULTS.clubAddress,
    clubPhone: typeof row.clubPhone === "string" ? row.clubPhone : DEFAULTS.clubPhone,
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
    allowPublicRegister:
      typeof row.allowPublicRegister === "boolean" ? row.allowPublicRegister : DEFAULTS.allowPublicRegister,
    maxStaffDiscountPercent:
      typeof row.maxStaffDiscountPercent === "number"
        ? row.maxStaffDiscountPercent
        : DEFAULTS.maxStaffDiscountPercent,
    debtAlertThresholdCents:
      typeof row.debtAlertThresholdCents === "number"
        ? row.debtAlertThresholdCents
        : DEFAULTS.debtAlertThresholdCents,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(),
  };
}

/** Read logo URL via SQL (works before `prisma generate` picks up `clubLogoUrl`). */
export async function readClubLogoUrl(): Promise<string> {
  try {
    const rows = await prisma.$queryRaw<Array<{ clubLogoUrl: string }>>`
      SELECT "clubLogoUrl" FROM "ClubSettings" WHERE id = 'default' LIMIT 1
    `;
    const value = rows[0]?.clubLogoUrl;
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

/** Persist logo URL via SQL (works before `prisma generate` picks up `clubLogoUrl`). */
export async function writeClubLogoUrl(clubLogoUrl: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "ClubSettings" SET "clubLogoUrl" = ${clubLogoUrl} WHERE id = 'default'
  `;
}

export async function getClubSettings(): Promise<ClubSettingsData> {
  const row = await prisma.clubSettings.findUnique({ where: { id: "default" } });
  if (!row) {
    const created = await prisma.clubSettings.create({ data: { id: "default" } });
    const settings = normalizeClubSettings(created as Record<string, unknown>);
    settings.clubLogoUrl = await readClubLogoUrl();
    return settings;
  }
  const settings = normalizeClubSettings(row as Record<string, unknown>);
  settings.clubLogoUrl = await readClubLogoUrl();
  return settings;
}

export { DEFAULTS as CLUB_SETTINGS_DEFAULTS };
