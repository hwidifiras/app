import { prisma } from "@/lib/prisma";

export type ClubSettingsData = {
  id: string;
  clubName: string;
  clubAddress: string;
  clubPhone: string;
  allowCheckInWithPartialPayment: boolean;
  allowCheckInWithoutSubscription: boolean;
  allowPublicRegister: boolean;
  maxStaffDiscountPercent: number;
  debtAlertThresholdCents: number;
  updatedAt: Date;
};

const DEFAULTS = {
  id: "default",
  clubName: "",
  clubAddress: "",
  clubPhone: "",
  allowCheckInWithPartialPayment: true,
  allowCheckInWithoutSubscription: true,
  allowPublicRegister: false,
  maxStaffDiscountPercent: 30,
  debtAlertThresholdCents: 0,
} as const;

export async function getClubSettings(): Promise<ClubSettingsData> {
  const row = await prisma.clubSettings.findUnique({ where: { id: "default" } });
  if (!row) {
    return prisma.clubSettings.create({ data: { id: "default" } });
  }
  return row;
}

export { DEFAULTS as CLUB_SETTINGS_DEFAULTS };
