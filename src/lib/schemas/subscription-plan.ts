import { z } from "zod";

export const createSubscriptionPlanSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  price: z.number().int().min(0, "Prix invalide").max(99999999, "Prix invalide"),
  totalSessions: z.number().int().min(1, "Minimum 1 séance").max(999, "Maximum 999 séances"),
  sessionsPerWeek: z.number().int().min(1, "Minimum 1 fois par semaine").max(7, "Maximum 7 fois par semaine").optional(),
  validityDays: z.number().int().min(1, "Durée minimum 1 jour").max(3650, "Durée maximum 10 ans"),
});

export type CreateSubscriptionPlanInput = z.infer<typeof createSubscriptionPlanSchema>;

export const updateSubscriptionPlanSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).optional().or(z.literal("")).optional(),
    price: z.number().int().min(0).max(99999999).optional(),
    totalSessions: z.number().int().min(1).max(999).optional(),
    sessionsPerWeek: z.number().int().min(1).max(7).optional(),
    validityDays: z.number().int().min(1).max(3650).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (payload) =>
      payload.name !== undefined ||
      payload.description !== undefined ||
      payload.price !== undefined ||
      payload.totalSessions !== undefined ||
      payload.sessionsPerWeek !== undefined ||
      payload.validityDays !== undefined ||
      payload.isActive !== undefined,
    {
      message: "Aucun champ à mettre à jour",
      path: ["_root"],
    },
  );

export type UpdateSubscriptionPlanInput = z.infer<typeof updateSubscriptionPlanSchema>;
