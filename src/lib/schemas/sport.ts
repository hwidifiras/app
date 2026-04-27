import { z } from "zod";

export const createSportSchema = z.object({
  name: z.string().trim().min(2, "Nom du sport invalide").max(60),
  description: z.string().trim().max(300).optional().or(z.literal("")),
});

export type CreateSportInput = z.infer<typeof createSportSchema>;

export const updateSportSchema = z
  .object({
    name: z.string().trim().min(2, "Nom du sport invalide").max(60).optional(),
    description: z
      .union([z.string().trim().max(300), z.literal(""), z.null()])
      .optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (payload) =>
      payload.name !== undefined ||
      payload.description !== undefined ||
      payload.isActive !== undefined,
    {
      message: "Aucun champ à mettre à jour",
      path: ["_root"],
    },
  );

export type UpdateSportInput = z.infer<typeof updateSportSchema>;
