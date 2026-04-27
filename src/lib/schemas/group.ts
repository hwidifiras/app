import { z } from "zod";

const dayOfWeekEnum = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const scheduleSchema = z.object({
  dayOfWeek: dayOfWeekEnum,
  startTime: z.string().regex(timeRegex, "Heure invalide (HH:MM)"),
  durationMinutes: z.number().int().min(30, "Durée minimum 30 minutes").max(240, "Durée maximum 240 minutes"),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
});

export const createGroupSchema = z.object({
  name: z.string().trim().min(2, "Nom du groupe invalide").max(100),
  sportId: z.string().trim().min(1, "Sport requis"),
  coachId: z.string().trim().min(1, "Coach requis"),
  capacity: z.number().int().min(1, "Capacité invalide").max(200, "Capacité invalide"),
  room: z.string().trim().min(1, "Salle requise").max(100),
  schedule: scheduleSchema,
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = z
  .object({
    name: z.string().trim().min(2, "Nom du groupe invalide").max(100).optional(),
    sportId: z.string().trim().min(1, "Sport requis").optional(),
    coachId: z.string().trim().min(1, "Coach requis").optional(),
    capacity: z.number().int().min(1, "Capacité invalide").max(200, "Capacité invalide").optional(),
    room: z.string().trim().min(1, "Salle requise").max(100).optional(),
    isActive: z.boolean().optional(),
    schedule: scheduleSchema.optional(),
  })
  .refine(
    (payload) =>
      payload.name !== undefined ||
      payload.sportId !== undefined ||
      payload.coachId !== undefined ||
      payload.capacity !== undefined ||
      payload.room !== undefined ||
      payload.isActive !== undefined ||
      payload.schedule !== undefined,
    {
      message: "Aucun champ à mettre à jour",
      path: ["_root"],
    },
  );

export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
