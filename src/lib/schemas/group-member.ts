import { z } from "zod";

const isoDateSchema = z.string().datetime("Date invalide");

export const createGroupMemberSchema = z
  .object({
    groupId: z.string().trim().min(1, "groupId requis"),
    memberId: z.string().trim().min(1, "memberId requis"),
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable().optional(),
  })
  .refine(
    (payload) => {
      if (!payload.endDate) {
        return true;
      }

      return new Date(payload.endDate).getTime() >= new Date(payload.startDate).getTime();
    },
    {
      message: "La date de fin doit être >= date de début",
      path: ["endDate"],
    },
  );

export const bulkCreateGroupMembersSchema = z
  .object({
    groupId: z.string().trim().min(1, "groupId requis"),
    memberIds: z.array(z.string().trim().min(1, "memberId invalide")).min(1, "Au moins un membre requis"),
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable().optional(),
  })
  .refine(
    (payload) => {
      if (!payload.endDate) {
        return true;
      }

      return new Date(payload.endDate).getTime() >= new Date(payload.startDate).getTime();
    },
    {
      message: "La date de fin doit être >= date de début",
      path: ["endDate"],
    },
  );

export const bulkDeleteGroupMembersSchema = z.object({
  groupId: z.string().trim().min(1, "groupId requis"),
  memberIds: z.array(z.string().trim().min(1, "memberId invalide")).min(1, "Au moins un membre requis"),
});

export const updateGroupMemberSchema = z
  .object({
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.nullable().optional(),
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  })
  .refine(
    (payload) => payload.startDate !== undefined || payload.endDate !== undefined || payload.status !== undefined,
    {
      message: "Aucun champ à mettre à jour",
      path: ["_root"],
    },
  )
  .refine(
    (payload) => {
      if (!payload.startDate || payload.endDate === undefined || payload.endDate === null) {
        return true;
      }

      return new Date(payload.endDate).getTime() >= new Date(payload.startDate).getTime();
    },
    {
      message: "La date de fin doit être >= date de début",
      path: ["endDate"],
    },
  );
