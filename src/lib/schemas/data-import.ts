import { z } from "zod";

const optionalText = z.string().trim().max(200).optional().or(z.literal(""));
const optionalDate = z.string().datetime().optional().or(z.literal(""));

export const dataImportAttendanceSchema = z.object({
  sessionId: z.string().trim().min(1),
  status: z.enum(["PRESENT", "ABSENT"]),
});

export const dataImportMemberSchema = z
  .object({
    firstName: z.string().trim().min(2, "Prénom requis").max(80),
    lastName: z.string().trim().min(2, "Nom requis").max(80),
    phone: z.string().trim().max(20).optional().or(z.literal("")),
    email: z.string().trim().email("Email invalide").optional().or(z.literal("")),
    memberType: z.enum(["ADULT", "KID", "NOT_SPECIFIED"]),
    birthDate: optionalDate,
    address: optionalText,
    parentName: optionalText,
    parentPhone: optionalText,
    joinedAt: z.string().datetime("Date d'inscription invalide"),
  })
  .superRefine((member, ctx) => {
    const phone = member.phone?.trim() ?? "";
    if (member.memberType !== "KID" && phone.length < 6) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Téléphone requis pour un membre adulte",
      });
    }
    if (member.memberType === "KID" && (member.parentPhone?.trim().length ?? 0) < 6) {
      ctx.addIssue({
        code: "custom",
        path: ["parentPhone"],
        message: "Téléphone du parent requis pour un enfant",
      });
    }
  });

export const dataImportPayloadSchema = z
  .object({
    cutoverDate: z.string().datetime("Date de bascule invalide"),
    member: dataImportMemberSchema,
    groupId: z.string().trim().min(1, "Groupe requis"),
    planId: z.string().trim().min(1, "Formule requise"),
    assignmentStartDate: z.string().datetime("Date d'affectation invalide"),
    subscriptionStartDate: z.string().datetime("Date de début invalide"),
    subscriptionEndDate: z.string().datetime("Date de fin invalide"),
    amountCents: z.number().int().min(0),
    paidCents: z.number().int().min(0),
    remainingSessions: z.number().int().min(1),
    paymentDate: optionalDate,
    paymentMethod: z.string().trim().max(50).optional().or(z.literal("")),
    note: z.string().trim().min(3, "Note de reprise requise").max(500),
    attendances: z.array(dataImportAttendanceSchema).max(14),
  })
  .superRefine((payload, ctx) => {
    const cutover = new Date(payload.cutoverDate);
    const joinedAt = new Date(payload.member.joinedAt);
    const assignmentStart = new Date(payload.assignmentStartDate);
    const subscriptionStart = new Date(payload.subscriptionStartDate);
    const subscriptionEnd = new Date(payload.subscriptionEndDate);

    if (payload.paidCents > payload.amountCents) {
      ctx.addIssue({
        code: "custom",
        path: ["paidCents"],
        message: "Le montant déjà payé dépasse le montant dû",
      });
    }
    if (subscriptionEnd < subscriptionStart) {
      ctx.addIssue({
        code: "custom",
        path: ["subscriptionEndDate"],
        message: "La fin doit être postérieure au début",
      });
    }
    if (subscriptionStart > cutover || assignmentStart > cutover || joinedAt > cutover) {
      ctx.addIssue({
        code: "custom",
        path: ["cutoverDate"],
        message: "Les dates de reprise ne peuvent pas commencer après la bascule",
      });
    }
    if (subscriptionEnd < cutover) {
      ctx.addIssue({
        code: "custom",
        path: ["subscriptionEndDate"],
        message: "Un abonnement repris comme actif ne peut pas être déjà expiré",
      });
    }

    const sessionIds = payload.attendances.map((attendance) => attendance.sessionId);
    if (new Set(sessionIds).size !== sessionIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["attendances"],
        message: "Une séance ne peut être sélectionnée qu'une seule fois",
      });
    }
  });

export type DataImportPayload = z.infer<typeof dataImportPayloadSchema>;
