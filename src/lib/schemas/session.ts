import { z } from "zod";

export const generateSessionsSchema = z.object({
  horizonDays: z.number().int().min(1, "horizonDays invalide").max(120, "horizonDays invalide").optional(),
});
