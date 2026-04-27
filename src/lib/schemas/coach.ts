import { z } from "zod";

export const createCoachSchema = z.object({
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
  sportId: z.union([z.string().trim().min(1), z.literal(""), z.null()]).optional(),
});

export type CreateCoachInput = z.infer<typeof createCoachSchema>;

export const updateCoachSchema = z
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
    sportId: z.union([z.string().trim().min(1), z.literal(""), z.null()]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (payload) =>
      payload.firstName !== undefined ||
      payload.lastName !== undefined ||
      payload.phone !== undefined ||
      payload.email !== undefined ||
      payload.sportId !== undefined ||
      payload.isActive !== undefined,
    {
      message: "Aucun champ à mettre à jour",
      path: ["_root"],
    },
  );

export type UpdateCoachInput = z.infer<typeof updateCoachSchema>;
