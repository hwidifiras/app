import { z } from "zod";

export const generateSessionsSchema = z.object({
  horizonDays: z.number().int().min(1, "horizonDays invalide").max(120, "horizonDays invalide").optional(),
});

export const updateSessionSchema = z.object({
  coachId: z.string().min(1, "coachId requis").optional(),
  room: z.string().min(1, "salle requise").optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "format HH:MM requis").optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "format HH:MM requis").optional(),
  status: z.enum(["PLANNED", "RESCHEDULED", "CANCELLED", "COMPLETED"]).optional(),
  exceptionReason: z.string().min(1, "motif requis").optional(),
}).refine(
  (data) => {
    if (data.status === "CANCELLED") {
      return !!data.exceptionReason && data.exceptionReason.length > 0;
    }
    return true;
  },
  { message: "Motif obligatoire pour une annulation", path: ["exceptionReason"] }
);
