import { z } from "zod";

import { totalSessionsFromWeekly } from "@/lib/subscription-plan-utils";

const optionalDescriptionSchema = z.string().trim().max(500).nullable().optional();

export const createSubscriptionPlanSchema = z
  .object({
    name: z.string().trim().min(2, "Nom trop court").max(100),
    description: optionalDescriptionSchema,
    price: z.number().int().min(0, "Prix invalide").max(99999999, "Prix invalide"),
    sessionsPerWeek: z
      .number()
      .int()
      .min(1, "Minimum 1 séance par semaine")
      .max(7, "Maximum 7 séances par semaine"),
    validityDays: z.number().int().min(1, "Durée minimum 1 jour").max(3650, "Durée maximum 10 ans"),
    sportId: z.string().trim().min(1, "Discipline requise"),
  })
  .transform((data) => ({
    ...data,
    totalSessions: totalSessionsFromWeekly(data.sessionsPerWeek),
  }));

export type CreateSubscriptionPlanInput = z.infer<typeof createSubscriptionPlanSchema>;

export const updateSubscriptionPlanSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: optionalDescriptionSchema,
    price: z.number().int().min(0).max(99999999).optional(),
    sessionsPerWeek: z.number().int().min(1).max(7).optional(),
    validityDays: z.number().int().min(1).max(3650).optional(),
    isActive: z.boolean().optional(),
    sportId: z.string().trim().optional().or(z.literal("")).optional(),
  })
  .refine(
    (payload) =>
      payload.name !== undefined ||
      payload.description !== undefined ||
      payload.price !== undefined ||
      payload.sessionsPerWeek !== undefined ||
      payload.validityDays !== undefined ||
      payload.isActive !== undefined ||
      payload.sportId !== undefined,
    {
      message: "Aucun champ à mettre à jour",
      path: ["_root"],
    },
  )
  .transform((payload) => {
    if (payload.sessionsPerWeek === undefined) {
      return payload;
    }

    return {
      ...payload,
      totalSessions: totalSessionsFromWeekly(payload.sessionsPerWeek),
    };
  });

export type UpdateSubscriptionPlanInput = z.infer<typeof updateSubscriptionPlanSchema>;
