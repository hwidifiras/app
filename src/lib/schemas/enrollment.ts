import { z } from "zod";

export const enrollmentLineSchema = z.object({
  memberId: z.string().trim().min(1).optional(),
  newMember: z
    .object({
      firstName: z.string().trim().min(1),
      lastName: z.string().trim().min(1),
      phone: z.string().trim().min(6),
      email: z.string().trim().email().optional().or(z.literal("")),
      memberType: z.enum(["ADULT", "KID", "NOT_SPECIFIED"]).default("NOT_SPECIFIED"),
      birthDate: z.string().optional(),
      address: z.string().optional(),
      parentName: z.string().optional(),
      parentPhone: z.string().optional(),
      parentAddress: z.string().optional(),
    })
    .refine(
      (member) =>
        member.memberType !== "KID" ||
        ((member.parentName?.trim().length ?? 0) > 0 &&
          (member.parentPhone?.trim().length ?? 0) > 0),
      {
        message: "Nom et téléphone du parent requis pour un enfant",
        path: ["parentName"],
      },
    )
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
