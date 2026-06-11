import { z } from "zod";

const newMemberBaseSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  memberType: z.enum(["ADULT", "KID", "NOT_SPECIFIED"]).default("NOT_SPECIFIED"),
  birthDate: z.string().optional(),
  address: z.string().optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  parentAddress: z.string().optional(),
});

export const enrollmentLineSchema = z.object({
  memberId: z.string().trim().min(1).optional(),
  newMember: newMemberBaseSchema
    .superRefine((member, ctx) => {
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
  paymentCents: z.number().int().min(0).optional(),
  paymentMethod: z.string().trim().optional(),
  paymentNotes: z.string().trim().optional(),
});

export const enrollmentQuoteSchema = z.object({
  lines: z.array(enrollmentLineSchema).min(1).max(10),
  offerId: z.string().trim().optional(),
  startDate: z.string().optional(),
  renewExisting: z.boolean().optional(),
});

export const enrollmentApplySchema = enrollmentQuoteSchema;

export type EnrollmentLineInput = z.infer<typeof enrollmentLineSchema>;
export type EnrollmentQuoteInput = z.infer<typeof enrollmentQuoteSchema>;
