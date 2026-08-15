import { z } from "zod";

export const subscriptionLifecycleReasonSchema = z.object({
  reason: z.string().trim().min(3, "Motif obligatoire").max(500),
});

export const entitlementAdjustmentSchema = z.object({
  unitsDelta: z.number().int().min(-10000).max(10000).refine((value) => value !== 0, "La correction ne peut pas être nulle"),
  reason: z.string().trim().min(3, "Motif obligatoire").max(500),
});

export const subscriptionReplacementSchema = z.object({
  planId: z.string().trim().min(1, "Formule requise"),
  startDate: z.string().datetime("Date de début invalide"),
  transferCents: z.number().int().min(0).optional(),
  groupIds: z.array(z.string().trim().min(1)).max(8).optional(),
  reason: z.string().trim().min(3, "Motif obligatoire").max(500),
});
