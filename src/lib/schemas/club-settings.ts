import { z } from "zod";

import { CLUB_DAY_VALUES } from "@/lib/club-working-days";
import { DASHBOARD_DEFAULT_MODES } from "@/lib/dashboard-preferences";

const clubLogoUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v), {
    message: "URL du logo invalide (chemin relatif ou https://)",
  });

const receiptPrefixSchema = z
  .string()
  .trim()
  .min(2)
  .max(10)
  .regex(/^[A-Za-z0-9-]+$/, "Prefixe recu invalide");

export const updateClubSettingsSchema = z.object({
  clubName: z.string().trim().max(120).optional(),
  clubLogoUrl: clubLogoUrlSchema.optional(),
  clubAddress: z.string().trim().max(240).optional(),
  clubPhone: z.string().trim().max(40).optional(),
  receiptLegalName: z.string().trim().max(160).optional(),
  receiptTaxId: z.string().trim().max(80).optional(),
  allowCheckInWithPartialPayment: z.boolean().optional(),
  allowCheckInWithoutSubscription: z.boolean().optional(),
  absentConsumesSession: z.boolean().optional(),
  allowSameRoomConcurrentGroups: z.boolean().optional(),
  allowCoachConcurrentSameRoomQualified: z.boolean().optional(),
  workingDays: z.array(z.enum(CLUB_DAY_VALUES)).min(1).optional(),
  maxStaffDiscountPercent: z.number().int().min(0).max(100).optional(),
  debtAlertThresholdCents: z.number().int().min(0).max(100_000_000).optional(),
  dashboardDefaultMode: z.enum(DASHBOARD_DEFAULT_MODES).optional(),
  dashboardShowTodaySessions: z.boolean().optional(),
  dashboardShowCashToday: z.boolean().optional(),
  dashboardShowDataConfidence: z.boolean().optional(),
  dashboardShowCashTrend: z.boolean().optional(),
  dashboardShowMembersOverview: z.boolean().optional(),
  dashboardShowCommercialInsights: z.boolean().optional(),
  dashboardShowDetailedDebts: z.boolean().optional(),
  receiptPrefix: receiptPrefixSchema.optional(),
  nextReceiptSequence: z.number().int().min(1).max(999_999_999).optional(),
  receiptFooter: z.string().trim().max(500).optional(),
  receiptEmailDefault: z.boolean().optional(),
  receiptPrintDefault: z.boolean().optional(),
});

export type UpdateClubSettingsInput = z.infer<typeof updateClubSettingsSchema>;
