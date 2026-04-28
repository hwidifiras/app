import { z } from "zod";

export const createSubscriptionPlanSchema = z.object({
  name: z.string().trim().min(2, "Nom trop court").max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  price: z.number().int().min(0, "Prix invalide").max(99999999, "Prix invalide"),
  durationDays: z.number().int().min(1, "Durée minimum 1 jour").max(3650, "Durée maximum 10 ans"),
});

export type CreateSubscriptionPlanInput = z.infer<typeof createSubscriptionPlanSchema>;

export const updateSubscriptionPlanSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).optional().or(z.literal("")).optional(),
    price: z.number().int().min(0).max(99999999).optional(),
    durationDays: z.number().int().min(1).max(3650).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (payload) =>
      payload.name !== undefined ||
      payload.description !== undefined ||
      payload.price !== undefined ||
      payload.durationDays !== undefined ||
      payload.isActive !== undefined,
    {
      message: "Aucun champ à mettre à jour",
      path: ["_root"],
    },
  );

export type UpdateSubscriptionPlanInput = z.infer<typeof updateSubscriptionPlanSchema>;
