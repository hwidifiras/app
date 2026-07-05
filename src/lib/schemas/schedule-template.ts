import { z } from "zod";

import { CLUB_DAY_VALUES } from "@/lib/club-working-days";

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const scheduleTemplateSlotSchema = z.object({
  dayOfWeek: z.enum(CLUB_DAY_VALUES),
  startTime: z.string().regex(timeRegex, "Heure invalide (HH:MM)"),
  durationMinutes: z.number().int().min(30, "Duree minimum 30 minutes").max(240, "Duree maximum 240 minutes"),
});

function hasDuplicateSlot(slots: Array<{ dayOfWeek: string; startTime: string }>) {
  const seen = new Set<string>();
  for (const slot of slots) {
    const key = `${slot.dayOfWeek}|${slot.startTime}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

export const createScheduleTemplateSchema = z.object({
  name: z.string().trim().min(2, "Nom du modele requis").max(100),
  description: z.string().trim().max(240).optional().or(z.literal("")),
  slots: z.array(scheduleTemplateSlotSchema).min(1, "Ajoutez au moins un horaire").max(21),
}).superRefine((data, ctx) => {
  if (hasDuplicateSlot(data.slots)) {
    ctx.addIssue({ code: "custom", path: ["slots"], message: "Un meme jour et horaire est present deux fois" });
  }
});

export const updateScheduleTemplateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(240).optional().or(z.literal("")),
  slots: z.array(scheduleTemplateSlotSchema).min(1).max(21).optional(),
  isActive: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.slots && hasDuplicateSlot(data.slots)) {
    ctx.addIssue({ code: "custom", path: ["slots"], message: "Un meme jour et horaire est present deux fois" });
  }
});

export const applyScheduleTemplateSchema = z
  .object({
    targetMode: z.enum(["SELECTED_GROUPS", "SPORT", "GROUP_TYPE", "ALL_ACTIVE"]),
    groupIds: z.array(z.string().trim().min(1)).optional(),
    sportId: z.string().trim().min(1).optional(),
    groupType: z.enum(["KIDS", "ADULTS", "MIXED"]).optional(),
    effectiveFrom: z.string().datetime("Date de debut invalide"),
    effectiveTo: z.string().datetime("Date de fin invalide").nullable().optional(),
    replaceExisting: z.boolean().default(true),
    dryRun: z.boolean().default(true),
    confirmFutureSessions: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.targetMode === "SELECTED_GROUPS" && (!data.groupIds || data.groupIds.length === 0)) {
      ctx.addIssue({ code: "custom", path: ["groupIds"], message: "Selectionnez au moins un groupe" });
    }
    if (data.targetMode === "SPORT" && !data.sportId) {
      ctx.addIssue({ code: "custom", path: ["sportId"], message: "Selectionnez une discipline" });
    }
    if (data.targetMode === "GROUP_TYPE" && !data.groupType) {
      ctx.addIssue({ code: "custom", path: ["groupType"], message: "Selectionnez enfants, adultes ou mixte" });
    }
    if (data.effectiveTo && new Date(data.effectiveTo).getTime() < new Date(data.effectiveFrom).getTime()) {
      ctx.addIssue({ code: "custom", path: ["effectiveTo"], message: "La date de fin doit etre apres la date de debut" });
    }
  });

export type CreateScheduleTemplateInput = z.infer<typeof createScheduleTemplateSchema>;
export type UpdateScheduleTemplateInput = z.infer<typeof updateScheduleTemplateSchema>;
export type ApplyScheduleTemplateInput = z.infer<typeof applyScheduleTemplateSchema>;
