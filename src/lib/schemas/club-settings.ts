import { z } from "zod";

import { CLUB_DAY_VALUES } from "@/lib/club-working-days";

const clubLogoUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v), {
    message: "URL du logo invalide (chemin relatif ou https://)",
  });

export const updateClubSettingsSchema = z.object({
  clubName: z.string().trim().max(120).optional(),
  clubLogoUrl: clubLogoUrlSchema.optional(),
  clubAddress: z.string().trim().max(240).optional(),
  clubPhone: z.string().trim().max(40).optional(),
  allowCheckInWithPartialPayment: z.boolean().optional(),
  allowCheckInWithoutSubscription: z.boolean().optional(),
  absentConsumesSession: z.boolean().optional(),
  allowSameRoomConcurrentGroups: z.boolean().optional(),
  allowCoachConcurrentSameRoomQualified: z.boolean().optional(),
  workingDays: z.array(z.enum(CLUB_DAY_VALUES)).min(1).optional(),
  maxStaffDiscountPercent: z.number().int().min(0).max(100).optional(),
  debtAlertThresholdCents: z.number().int().min(0).max(100_000_000).optional(),
});

export type UpdateClubSettingsInput = z.infer<typeof updateClubSettingsSchema>;
