import { z } from "zod";

export const householdRelationshipEnum = z.enum([
  "PARENT",
  "CHILD",
  "SIBLING",
  "GUARDIAN",
  "OTHER",
]);

export const createHouseholdSchema = z.object({
  label: z.string().trim().max(120).optional().or(z.literal("")),
  memberId: z.string().trim().min(1),
  relationship: householdRelationshipEnum.default("OTHER"),
});

export const addHouseholdMemberSchema = z.object({
  householdId: z.string().trim().min(1),
  memberId: z.string().trim().min(1),
  relationship: householdRelationshipEnum.default("OTHER"),
});

export const updateHouseholdMemberSchema = z.object({
  relationship: householdRelationshipEnum.optional(),
});
