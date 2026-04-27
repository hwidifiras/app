import { z } from "zod";

export const createMemberSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est requis").max(60),
  lastName: z.string().trim().min(1, "Le nom est requis").max(60),
  phone: z
    .string()
    .trim()
    .min(6, "Téléphone invalide")
    .max(20, "Téléphone invalide"),
  email: z
    .string()
    .trim()
    .email("Email invalide")
    .optional()
    .or(z.literal("")),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const updateMemberSchema = z
  .object({
    firstName: z.string().trim().min(1, "Le prénom est requis").max(60).optional(),
    lastName: z.string().trim().min(1, "Le nom est requis").max(60).optional(),
    phone: z
      .string()
      .trim()
      .min(6, "Téléphone invalide")
      .max(20, "Téléphone invalide")
      .optional(),
    email: z
      .union([z.string().trim().email("Email invalide"), z.literal(""), z.null()])
      .optional(),
  })
  .refine(
    (payload) =>
      payload.firstName !== undefined ||
      payload.lastName !== undefined ||
      payload.phone !== undefined ||
      payload.email !== undefined,
    {
      message: "Aucun champ à mettre à jour",
      path: ["_root"],
    },
  );

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
