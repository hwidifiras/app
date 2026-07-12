import { z } from "zod";

export const gymCheckInSchema = z.object({
  memberId: z.string().trim().min(1),
  overrideReason: z.string().trim().min(3).max(300).optional(),
});

export const gymVisitReversalSchema = z.object({
  visitId: z.string().trim().min(1),
  reason: z.string().trim().min(3).max(300),
});

export type GymCheckInInput = z.infer<typeof gymCheckInSchema>;
export type GymVisitReversalInput = z.infer<typeof gymVisitReversalSchema>;
