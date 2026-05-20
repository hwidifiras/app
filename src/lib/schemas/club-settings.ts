import { z } from "zod";

export const updateClubSettingsSchema = z.object({
  clubName: z.string().trim().max(120).optional(),
  clubAddress: z.string().trim().max(240).optional(),
  clubPhone: z.string().trim().max(40).optional(),
  allowCheckInWithPartialPayment: z.boolean().optional(),
  allowCheckInWithoutSubscription: z.boolean().optional(),
  maxStaffDiscountPercent: z.number().int().min(0).max(100).optional(),
  debtAlertThresholdCents: z.number().int().min(0).max(100_000_000).optional(),
});

export type UpdateClubSettingsInput = z.infer<typeof updateClubSettingsSchema>;
