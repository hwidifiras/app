import { z } from "zod";

import { ACTIVITY_TEMPLATES } from "@/platform/onboarding/activity-templates";

export const CURRENT_TERMS_VERSION = "2026-08-16";
export const CURRENT_PRIVACY_VERSION = "2026-08-16";

const passwordSchema = z
  .string()
  .min(10, "Utilisez au moins 10 caractères")
  .max(128, "Le mot de passe est trop long")
  .refine((value) => value.trim() === value, "Retirez les espaces au début ou à la fin")
  .refine((value) => /\p{L}/u.test(value) && /\d/.test(value), "Ajoutez au moins une lettre et un chiffre");

export const signupStartSchema = z.object({
  ownerName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: passwordSchema,
  termsAccepted: z.literal(true),
  inviteToken: z.string().trim().min(20).max(256).optional(),
  antiBotToken: z.string().trim().min(1).max(4096).optional(),
});

export const signupVerifySchema = z
  .object({
    signupId: z.string().trim().min(10).max(64).optional(),
    code: z.string().trim().regex(/^\d{6}$/).optional(),
    token: z.string().trim().min(20).max(256).optional(),
  })
  .refine((value) => Boolean(value.code || value.token), "Code ou lien de vérification requis");

const activityTemplateKeys = new Set(ACTIVITY_TEMPLATES.map((template) => template.key));

export const signupProvisionSchema = z.object({
  clubName: z.string().trim().min(2).max(120),
  clubPhone: z.string().trim().max(30).default(""),
  clubAddress: z.string().trim().max(200).default(""),
  slug: z.string().trim().min(3).max(63),
  edition: z.enum(["CLASS", "GYM", "HYBRID"]),
  activityTemplateKeys: z
    .array(z.string().refine((value) => activityTemplateKeys.has(value as never), "Modèle inconnu"))
    .max(3)
    .default([]),
});

export const workspaceLookupSchema = z.object({
  slug: z.string().trim().min(2).max(80),
});

export type SignupStartInput = z.infer<typeof signupStartSchema>;
export type SignupProvisionInput = z.infer<typeof signupProvisionSchema>;
