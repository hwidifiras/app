import { z } from "zod";

import { CLUB_DAY_VALUES } from "@/lib/club-working-days";
import { ACTIVITY_TEMPLATES } from "@/platform/onboarding/activity-templates";

const knownTemplateKeys = new Set(ACTIVITY_TEMPLATES.map((template) => template.key));

const templateKeysSchema = z
  .array(z.string().refine((value) => knownTemplateKeys.has(value as never), "Modèle inconnu"))
  .max(3)
  .transform((values) => Array.from(new Set(values)));

const disciplineNamesSchema = z
  .array(z.string().trim().min(2).max(80))
  .max(20)
  .transform((values) => {
    const unique = new Map<string, string>();
    for (const value of values) {
      const normalized = value.replace(/\s+/g, " ").trim();
      if (normalized) unique.set(normalized.toLocaleLowerCase("fr"), normalized);
    }
    return [...unique.values()];
  });

export const onboardingMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("PROFILE"),
    clubName: z.string().trim().min(2).max(120),
    clubPhone: z.string().trim().max(40),
    clubAddress: z.string().trim().max(240),
    workingDays: z.array(z.enum(CLUB_DAY_VALUES)).min(1).refine(
      (values) => new Set(values).size === values.length,
      "Un jour ne peut être sélectionné qu'une fois",
    ),
  }),
  z.object({
    action: z.literal("ACTIVITIES"),
    templateKeys: templateKeysSchema,
    disciplineNames: disciplineNamesSchema,
  }),
  z.object({
    action: z.literal("POLICIES"),
    allowCheckInWithPartialPayment: z.boolean(),
    absentConsumesSession: z.boolean(),
    gymAllowCheckInWithPartialPayment: z.boolean(),
    gymAllowExceptionalAccess: z.boolean(),
  }),
  z.object({ action: z.literal("COMPLETE") }),
]);

export type OnboardingMutation = z.infer<typeof onboardingMutationSchema>;
