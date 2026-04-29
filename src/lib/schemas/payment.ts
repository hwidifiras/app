import { z } from "zod";

export const createPaymentSchema = z.object({
  memberSubscriptionId: z.string().trim().min(1, "Abonnement requis"),
  amount: z.number().int().min(1, "Montant minimum 1 centime").max(99999999, "Montant invalide"),
  paymentDate: z.string().datetime().optional(),
  paymentMethod: z.string().trim().max(50).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const updatePaymentSchema = z
  .object({
    amount: z.number().int().min(1).max(99999999).optional(),
    paymentDate: z.string().datetime().optional(),
    paymentMethod: z.string().trim().max(50).optional().or(z.literal("")),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .refine(
    (payload) =>
      payload.amount !== undefined ||
      payload.paymentDate !== undefined ||
      payload.paymentMethod !== undefined ||
      payload.notes !== undefined,
    {
      message: "Aucun champ à mettre à jour",
      path: ["_root"],
    },
  );

export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
