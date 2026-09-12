import { z } from "zod";

const newMemberBaseSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  memberType: z.enum(["ADULT", "KID", "NOT_SPECIFIED"]).default("NOT_SPECIFIED"),
  gender: z.enum(["MALE", "FEMALE", "NOT_SPECIFIED"]).default("NOT_SPECIFIED"),
  birthDate: z.string().datetime({ message: "Date de naissance requise" }).refine(
    (value) => new Date(value) <= new Date(),
    "La date de naissance ne peut pas être dans le futur",
  ),
  address: z.string().optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  parentAddress: z.string().optional(),
});

export const enrollmentLineSchema = z.object({
  memberId: z.string().trim().min(1).optional(),
  newMember: newMemberBaseSchema
    .superRefine((member, ctx) => {
      if (member.gender === "NOT_SPECIFIED") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Genre requis",
          path: ["gender"],
        });
      }

      const phone = member.phone?.trim() ?? "";
      if (member.memberType !== "KID" && phone.length < 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Téléphone requis",
          path: ["phone"],
        });
      }
      if (member.memberType === "KID") {
        if ((member.parentName?.trim().length ?? 0) === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Nom du parent requis pour un enfant",
            path: ["parentName"],
          });
        }
        if ((member.parentPhone?.trim().length ?? 0) < 6) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Téléphone du parent requis pour un enfant",
            path: ["parentPhone"],
          });
        }
      }
    })
    .optional(),
  groupId: z.string().trim().min(1),
  planId: z.string().trim().min(1),
  startDate: z.string().datetime({ message: "Date réelle de début invalide" }).optional(),
  paymentDate: z.string().datetime({ message: "Date réelle du paiement invalide" }).refine(
    (value) => new Date(value) <= new Date(),
    "La date du paiement ne peut pas être dans le futur",
  ).optional(),
  paymentCents: z.number().int().min(0).optional(),
  paymentMethod: z.string().trim().optional(),
  paymentNotes: z.string().trim().optional(),
  insuranceMode: z.enum(["AUTO", "DUE_NOW", "PAID_PREVIOUSLY"]).optional(),
  insurancePaidDate: z.string().datetime({ message: "Date de l'assurance invalide" }).refine(
    (value) => new Date(value) <= new Date(),
    "La date de l'assurance ne peut pas être dans le futur",
  ).optional(),
}).superRefine((line, ctx) => {
  if (line.insuranceMode === "PAID_PREVIOUSLY" && !line.insurancePaidDate) {
    ctx.addIssue({ code: "custom", path: ["insurancePaidDate"], message: "Date du paiement de l'assurance requise" });
  }
});

export const enrollmentQuoteSchema = z.object({
  lines: z.array(enrollmentLineSchema).min(1).max(10),
  offerId: z.string().trim().optional(),
  startDate: z.string().optional(),
  renewExisting: z.boolean().optional(),
  customTotalCents: z.number().int().min(0).optional(),
  customOfferName: z.string().trim().max(120).optional(),
}).superRefine((quote, ctx) => {
  if (quote.offerId && quote.customTotalCents !== undefined) {
    ctx.addIssue({ code: "custom", path: ["customTotalCents"], message: "Choisissez une offre ou un prix personnalisé" });
  }
});

export const enrollmentApplySchema = enrollmentQuoteSchema;

export type EnrollmentLineInput = z.infer<typeof enrollmentLineSchema>;
export type EnrollmentQuoteInput = z.infer<typeof enrollmentQuoteSchema>;
