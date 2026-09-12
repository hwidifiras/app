import { z } from "zod";

import { createMemberSchema } from "@/lib/schemas/member";

const subscriptionStatusEnum = z.enum(["DRAFT", "ACTIVE", "EXPIRED", "CANCELLED"]);

export const createMemberSubscriptionSchema = z.object({
  memberId: z.string().trim().min(1, "Membre requis").optional(),
  newMember: createMemberSchema.optional(),
  planId: z.string().trim().min(1, "Plan requis"),
  offerId: z.string().trim().min(1).optional(),
  customPriceCents: z.number().int().min(0).optional(),
  customOfferName: z.string().trim().max(120).optional(),
  insuranceMode: z.enum(["AUTO", "DUE_NOW", "PAID_PREVIOUSLY"]).optional(),
  insurancePaidDate: z.string().datetime("Date de l'assurance invalide").refine(
    (value) => new Date(value) <= new Date(),
    "La date de l'assurance ne peut pas être dans le futur",
  ).optional(),
  startDate: z.string().datetime("Date de début invalide"),
  carryOverRemainingSessions: z.boolean().optional(),
  paymentCents: z.number().int().min(0).optional(),
  paymentDate: z.string().datetime("Date réelle du paiement invalide").refine(
    (value) => new Date(value) <= new Date(),
    "La date du paiement ne peut pas être dans le futur",
  ).optional(),
  paymentMethod: z.string().trim().max(40).optional(),
  groupIds: z
    .array(z.string().trim().min(1))
    .max(8)
    .refine((ids) => new Set(ids).size === ids.length, "Un groupe ne peut etre selectionne qu'une fois")
    .optional(),
}).superRefine((value, ctx) => {
  if (Boolean(value.memberId) === Boolean(value.newMember)) {
    ctx.addIssue({ code: "custom", path: ["memberId"], message: "Choisissez un membre existant ou creez-en un nouveau" });
  }
  if (value.offerId && value.customPriceCents !== undefined) {
    ctx.addIssue({ code: "custom", path: ["customPriceCents"], message: "Choisissez une offre ou un prix personnalisé" });
  }
  if (value.insuranceMode === "PAID_PREVIOUSLY" && !value.insurancePaidDate) {
    ctx.addIssue({ code: "custom", path: ["insurancePaidDate"], message: "Date du paiement de l'assurance requise" });
  }
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
