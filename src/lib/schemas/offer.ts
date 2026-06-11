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

export const createOfferSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).optional().or(z.literal("")),
    kind: offerKindEnum,
    isActive: z.boolean().optional(),
    percentOff: z.number().int().min(1).max(100).optional(),
    amountOffCents: z.number().int().min(1).optional(),
    bundlePriceCents: z.number().int().min(0).optional(),
    minMembers: z.number().int().min(2).max(10).optional(),
    requiresHousehold: z.boolean().optional(),
    maxMembers: z.number().int().min(1).max(10).optional(),
    sportId: z.string().trim().optional(),
    rules: z.record(z.string(), z.unknown()).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.rules && Object.keys(data.rules).length > 0) {
      try {
        parseOfferRules(data.kind, data.rules);
      } catch {
        ctx.addIssue({ code: "custom", message: "Règles d'offre invalides", path: ["rules"] });
      }
      return;
    }

    switch (data.kind) {
      case "FAMILY_BUNDLE":
        if (data.bundlePriceCents == null) {
          ctx.addIssue({
            code: "custom",
            message: "Prix du forfait requis",
            path: ["bundlePriceCents"],
          });
        }
        break;
      case "SECOND_DISCIPLINE":
      case "PERCENT_OFF":
        if (data.percentOff == null) {
          ctx.addIssue({
            code: "custom",
            message: "Pourcentage de réduction requis",
            path: ["percentOff"],
          });
        }
        break;
      case "FIXED_OFF":
        if (data.amountOffCents == null) {
          ctx.addIssue({
            code: "custom",
            message: "Montant de réduction requis",
            path: ["amountOffCents"],
          });
        }
        break;
      default:
        break;
    }
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
