import { z } from "zod";

export const gymCheckInSchema = z.object({
  memberId: z.string().trim().min(1).optional(),
  credentialCode: z.string().trim().min(20).max(500).optional(),
  overrideReason: z.string().trim().min(3).max(300).optional(),
}).superRefine((data, context) => {
  if (Boolean(data.memberId) === Boolean(data.credentialCode)) {
    context.addIssue({
      code: "custom",
      path: ["memberId"],
      message: "Fournissez soit le membre, soit le code de sa carte",
    });
  }
});

export const gymVisitReversalSchema = z.object({
  visitId: z.string().trim().min(1),
  reason: z.string().trim().min(3).max(300),
});

export const gymCredentialIssueSchema = z.object({
  memberId: z.string().trim().min(1),
  replacementReason: z.string().trim().min(3).max(300).optional(),
});

export const gymCredentialRevokeSchema = z.object({
  credentialId: z.string().trim().min(1),
  reason: z.string().trim().min(3).max(300),
});

export type GymCheckInInput = z.infer<typeof gymCheckInSchema>;
export type GymVisitReversalInput = z.infer<typeof gymVisitReversalSchema>;
