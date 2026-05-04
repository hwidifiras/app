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
  memberType: z.enum(["ADULT", "KID", "NOT_SPECIFIED"]),
  birthDate: z.string().datetime({ message: "Date de naissance invalide" }),
  address: z.string().trim().max(200).optional(),
  parentName: z.string().trim().max(120).optional(),
  parentPhone: z.string().trim().max(20).optional(),
  parentAddress: z.string().trim().max(200).optional(),
}).refine(
  (data) => {
    if (data.memberType === "KID") {
      return !!data.parentName?.trim() && !!data.parentPhone?.trim();
    }
    return true;
  },
  { message: "Parent requis pour un enfant", path: ["parentName"] },
);

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
    memberType: z.enum(["ADULT", "KID", "NOT_SPECIFIED"]).optional(),
    birthDate: z.string().datetime({ message: "Date de naissance invalide" }).optional(),
    address: z.string().trim().max(200).optional(),
    parentName: z.string().trim().max(120).optional(),
    parentPhone: z.string().trim().max(20).optional(),
    parentAddress: z.string().trim().max(200).optional(),
  })
  .refine(
    (payload) =>
      payload.firstName !== undefined ||
      payload.lastName !== undefined ||
      payload.phone !== undefined ||
      payload.email !== undefined ||
      payload.memberType !== undefined ||
      payload.birthDate !== undefined ||
      payload.address !== undefined ||
      payload.parentName !== undefined ||
      payload.parentPhone !== undefined ||
      payload.parentAddress !== undefined,
    {
      message: "Aucun champ à mettre à jour",
      path: ["_root"],
    },
  );

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
