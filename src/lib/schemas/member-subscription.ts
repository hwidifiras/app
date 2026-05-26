import { z } from "zod";

const subscriptionStatusEnum = z.enum(["DRAFT", "ACTIVE", "EXPIRED", "CANCELLED"]);

export const createMemberSubscriptionSchema = z.object({
  memberId: z.string().trim().min(1, "Membre requis"),
  planId: z.string().trim().min(1, "Plan requis"),
  startDate: z.string().datetime("Date de début invalide"),
  carryOverRemainingSessions: z.boolean().optional(),
  paymentCents: z.number().int().min(0).optional(),
  paymentMethod: z.string().trim().max(40).optional(),
});

export type CreateMemberSubscriptionInput = z.infer<typeof createMemberSubscriptionSchema>;

export const updateMemberSubscriptionSchema = z
  .object({
    planId: z.string().trim().min(1).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().nullable().optional(),
    amount: z.number().int().min(0).optional(),
    remainingSessions: z.number().int().min(0).optional(),
    status: subscriptionStatusEnum.optional(),
    adjustmentReason: z.string().trim().min(3).max(500).optional(),
  })
  .refine(
    (payload) =>
      payload.planId !== undefined ||
      payload.startDate !== undefined ||
      payload.endDate !== undefined ||
      payload.amount !== undefined ||
      payload.remainingSessions !== undefined ||
      payload.status !== undefined,
    {
      message: "Aucun champ à mettre à jour",
      path: ["_root"],
    },
  );

export type UpdateMemberSubscriptionInput = z.infer<typeof updateMemberSubscriptionSchema>;
