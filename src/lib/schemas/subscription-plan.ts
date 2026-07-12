import { z } from "zod";

import { totalSessionsFromWeekly } from "@/lib/subscription-plan-utils";

const optionalDescriptionSchema = z.string().trim().max(500).nullable().optional();
const planKindSchema = z.enum(["CLASS", "GYM", "MIXED"]);
const entitlementSchema = z
  .object({
    type: z.enum(["CLASS_SESSIONS", "GYM_ACCESS"]),
    sportId: z.string().trim().min(1).nullable().optional(),
    sessionsPerWeek: z.number().int().min(1).max(7).nullable().optional(),
    grantedUnits: z.number().int().min(1).max(10000).nullable().optional(),
    gymAccessMode: z.enum(["UNLIMITED", "VISIT_QUOTA"]).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "CLASS_SESSIONS") {
      if (!value.sportId) ctx.addIssue({ code: "custom", path: ["sportId"], message: "Discipline requise" });
      if (!value.sessionsPerWeek) ctx.addIssue({ code: "custom", path: ["sessionsPerWeek"], message: "Quota hebdomadaire requis" });
      if (!value.grantedUnits) ctx.addIssue({ code: "custom", path: ["grantedUnits"], message: "Nombre de séances requis" });
    } else {
      if (!value.gymAccessMode) ctx.addIssue({ code: "custom", path: ["gymAccessMode"], message: "Mode d'accès requis" });
      if (value.gymAccessMode === "VISIT_QUOTA" && !value.grantedUnits) {
        ctx.addIssue({ code: "custom", path: ["grantedUnits"], message: "Quota de visites requis" });
      }
    }
  });

function validateEntitlementMix(
  value: { planKind: "CLASS" | "GYM" | "MIXED"; entitlements?: z.infer<typeof entitlementSchema>[] },
  ctx: z.RefinementCtx,
) {
  if (!value.entitlements) return;
  const classRights = value.entitlements.filter((item) => item.type === "CLASS_SESSIONS");
  const gymRights = value.entitlements.filter((item) => item.type === "GYM_ACCESS");
  if (new Set(classRights.map((item) => item.sportId)).size !== classRights.length) {
    ctx.addIssue({ code: "custom", path: ["entitlements"], message: "Une discipline ne peut apparaître qu'une fois" });
  }
  if (gymRights.length > 1) {
    ctx.addIssue({ code: "custom", path: ["entitlements"], message: "Un seul droit salle est autorisé" });
  }
  if (value.planKind === "CLASS" && (classRights.length !== 1 || gymRights.length !== 0)) {
    ctx.addIssue({ code: "custom", path: ["entitlements"], message: "Une formule cours doit contenir une discipline" });
  }
  if (value.planKind === "GYM" && (gymRights.length !== 1 || classRights.length !== 0)) {
    ctx.addIssue({ code: "custom", path: ["entitlements"], message: "Un pass salle doit contenir un accès salle" });
  }
  if (value.planKind === "MIXED" && (gymRights.length !== 1 || classRights.length < 1)) {
    ctx.addIssue({ code: "custom", path: ["entitlements"], message: "Un pack mixte exige au moins un cours et un accès salle" });
  }
}

export const createSubscriptionPlanSchema = z
  .object({
    name: z.string().trim().min(2, "Nom trop court").max(100),
    description: optionalDescriptionSchema,
    price: z.number().int().min(0, "Prix invalide").max(99999999, "Prix invalide"),
    planKind: planKindSchema.default("CLASS"),
    validityDays: z.number().int().min(1, "Durée minimum 1 jour").max(3650, "Durée maximum 10 ans"),
    sportId: z.string().trim().min(1).optional(),
    sessionsPerWeek: z.number().int().min(1).max(7).optional(),
    entitlements: z.array(entitlementSchema).min(1).max(8).optional(),
  })
  .transform((data) => {
    const entitlements = data.entitlements ?? (data.sportId && data.sessionsPerWeek
      ? [{
          type: "CLASS_SESSIONS" as const,
          sportId: data.sportId,
          sessionsPerWeek: data.sessionsPerWeek,
          grantedUnits: totalSessionsFromWeekly(data.sessionsPerWeek),
          gymAccessMode: null,
        }]
      : []);
    const classRights = entitlements.filter((item) => item.type === "CLASS_SESSIONS");
    return {
      ...data,
      entitlements,
      sportId: data.planKind === "CLASS" ? classRights[0]?.sportId : undefined,
      sessionsPerWeek: data.planKind === "CLASS" ? classRights[0]?.sessionsPerWeek ?? undefined : undefined,
      totalSessions: classRights.reduce((sum, item) => sum + (item.grantedUnits ?? 0), 0),
    };
  })
  .superRefine(validateEntitlementMix);

export type CreateSubscriptionPlanInput = z.infer<typeof createSubscriptionPlanSchema>;

export const updateSubscriptionPlanSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: optionalDescriptionSchema,
    price: z.number().int().min(0).max(99999999).optional(),
    planKind: planKindSchema.optional(),
    sessionsPerWeek: z.number().int().min(1).max(7).optional(),
    validityDays: z.number().int().min(1).max(3650).optional(),
    isActive: z.boolean().optional(),
    sportId: z.string().trim().optional().or(z.literal("")),
    entitlements: z.array(entitlementSchema).min(1).max(8).optional(),
  })
  .refine((payload) => Object.values(payload).some((value) => value !== undefined), {
    message: "Aucun champ à mettre à jour",
    path: ["_root"],
  });

export type UpdateSubscriptionPlanInput = z.infer<typeof updateSubscriptionPlanSchema>;
