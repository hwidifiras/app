import { z } from "zod";

export const offerKindEnum = z.enum([
  "FAMILY_BUNDLE",
  "SECOND_DISCIPLINE",
  "PERCENT_OFF",
  "FIXED_OFF",
]);

export const familyBundleRulesSchema = z.object({
  minMembers: z.number().int().min(2).max(10),
  requiresHousehold: z.boolean().default(true),
  bundlePriceCents: z.number().int().min(0),
  sportId: z.string().trim().optional(),
});

export const secondDisciplineRulesSchema = z.object({
  percentOff: z.number().int().min(1).max(100),
});

export const percentOffRulesSchema = z.object({
  percentOff: z.number().int().min(1).max(100),
  maxMembers: z.number().int().min(1).max(10).optional(),
});

export const fixedOffRulesSchema = z.object({
  amountOffCents: z.number().int().min(1),
  maxMembers: z.number().int().min(1).max(10).optional(),
});

export const createOfferSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  kind: offerKindEnum,
  rules: z.record(z.string(), z.unknown()),
  isActive: z.boolean().optional(),
});

export type CreateOfferInput = z.infer<typeof createOfferSchema>;

export function parseOfferRules(kind: z.infer<typeof offerKindEnum>, rules: unknown) {
  switch (kind) {
    case "FAMILY_BUNDLE":
      return familyBundleRulesSchema.parse(rules);
    case "SECOND_DISCIPLINE":
      return secondDisciplineRulesSchema.parse(rules);
    case "PERCENT_OFF":
      return percentOffRulesSchema.parse(rules);
    case "FIXED_OFF":
      return fixedOffRulesSchema.parse(rules);
    default:
      throw new Error("Type d'offre invalide");
  }
}
