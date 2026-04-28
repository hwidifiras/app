import { z } from "zod";

const attendanceStatusEnum = z.enum(["PRESENT", "ABSENT", "EXCUSED", "OVERRIDE"]);

export const createAttendanceSchema = z.object({
  sessionId: z.string().trim().min(1, "Séance requise"),
  memberId: z.string().trim().min(1, "Membre requis"),
  status: attendanceStatusEnum,
  overrideReason: z.string().trim().max(500).optional().or(z.literal("")),
  checkedBy: z.string().trim().max(100).optional().or(z.literal("")),
});

export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;

export const updateAttendanceSchema = z
  .object({
    status: attendanceStatusEnum.optional(),
    overrideReason: z.string().trim().max(500).optional().or(z.literal("")).optional(),
    checkedBy: z.string().trim().max(100).optional().or(z.literal("")).optional(),
  })
  .refine(
    (payload) =>
      payload.status !== undefined ||
      payload.overrideReason !== undefined ||
      payload.checkedBy !== undefined,
    {
      message: "Aucun champ à mettre à jour",
      path: ["_root"],
    },
  );

export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
