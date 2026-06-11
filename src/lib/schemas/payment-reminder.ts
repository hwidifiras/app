import { z } from "zod";

export const sendPaymentRemindersSchema = z.object({
  memberIds: z.array(z.string().trim().min(1)).min(1).max(50),
  force: z.boolean().optional(),
});

export type SendPaymentRemindersInput = z.infer<typeof sendPaymentRemindersSchema>;
