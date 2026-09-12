import { describe, expect, it } from "vitest";

import { enrollmentLineSchema } from "@/lib/schemas/enrollment";

const baseLine = {
  groupId: "group-1",
  planId: "plan-1",
  startDate: "2026-08-15T00:00:00.000Z",
  paymentDate: "2026-08-14T00:00:00.000Z",
};

describe("enrollment business dates and contact rules", () => {
  it("accepts past start and payment dates", () => {
    expect(enrollmentLineSchema.safeParse({ memberId: "member-1", ...baseLine }).success).toBe(true);
  });

  it("accepts a child without a personal phone when the parent phone is present", () => {
    const result = enrollmentLineSchema.safeParse({
      ...baseLine,
      newMember: {
        firstName: "Aya",
        lastName: "Test",
        phone: "",
        memberType: "KID",
        gender: "FEMALE",
        birthDate: "2018-05-10T00:00:00.000Z",
        parentName: "Parent Test",
        parentPhone: "0612345678",
      },
    });

    expect(result.success).toBe(true);
  });

  it("requires the parent phone for a child and the member phone for an adult", () => {
    const kid = enrollmentLineSchema.safeParse({
      ...baseLine,
      newMember: {
        firstName: "Aya",
        lastName: "Test",
        phone: "",
        memberType: "KID",
        gender: "FEMALE",
        birthDate: "2018-05-10T00:00:00.000Z",
        parentName: "Parent Test",
        parentPhone: "",
      },
    });
    const adult = enrollmentLineSchema.safeParse({
      ...baseLine,
      newMember: {
        firstName: "Adulte",
        lastName: "Test",
        phone: "",
        memberType: "ADULT",
        gender: "MALE",
        birthDate: "1990-05-10T00:00:00.000Z",
      },
    });

    expect(kid.success).toBe(false);
    expect(adult.success).toBe(false);
  });

  it("rejects future payment and birth dates", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const result = enrollmentLineSchema.safeParse({
      ...baseLine,
      paymentDate: future,
      newMember: {
        firstName: "Adulte",
        lastName: "Test",
        phone: "0612345678",
        memberType: "ADULT",
        gender: "MALE",
        birthDate: future,
      },
    });

    expect(result.success).toBe(false);
  });
});
