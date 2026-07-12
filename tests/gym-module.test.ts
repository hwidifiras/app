import { describe, expect, it } from "vitest";

import { PERMISSIONS } from "@/lib/permission-definitions";
import { gymCheckInSchema, gymVisitReversalSchema } from "@/lib/schemas/gym";
import { createMemberSubscriptionSchema } from "@/lib/schemas/member-subscription";
import { createSubscriptionPlanSchema } from "@/lib/schemas/subscription-plan";

describe("gym module catalogue", () => {
  it("keeps the legacy class formula payload compatible", () => {
    const parsed = createSubscriptionPlanSchema.parse({
      name: "Boxe mensuelle",
      price: 4500,
      sessionsPerWeek: 3,
      validityDays: 30,
      sportId: "sport-boxe",
    });
    expect(parsed.planKind).toBe("CLASS");
    expect(parsed.totalSessions).toBe(12);
    expect(parsed.entitlements).toEqual([
      expect.objectContaining({ type: "CLASS_SESSIONS", sportId: "sport-boxe", grantedUnits: 12 }),
    ]);
  });

  it("accepts unlimited and quota gym formulas", () => {
    const unlimited = createSubscriptionPlanSchema.parse({
      name: "Salle illimitee",
      price: 6000,
      planKind: "GYM",
      validityDays: 30,
      entitlements: [{ type: "GYM_ACCESS", gymAccessMode: "UNLIMITED" }],
    });
    const quota = createSubscriptionPlanSchema.parse({
      name: "Salle 12 visites",
      price: 4500,
      planKind: "GYM",
      validityDays: 30,
      entitlements: [{ type: "GYM_ACCESS", gymAccessMode: "VISIT_QUOTA", grantedUnits: 12 }],
    });
    expect(unlimited.sportId).toBeUndefined();
    expect(quota.entitlements[0].grantedUnits).toBe(12);
  });

  it("requires both class and gym rights in a mixed pack", () => {
    const valid = createSubscriptionPlanSchema.safeParse({
      name: "Kick-boxing + salle",
      price: 9000,
      planKind: "MIXED",
      validityDays: 30,
      entitlements: [
        { type: "CLASS_SESSIONS", sportId: "sport-kb", sessionsPerWeek: 2, grantedUnits: 8 },
        { type: "GYM_ACCESS", gymAccessMode: "UNLIMITED" },
      ],
    });
    const invalid = createSubscriptionPlanSchema.safeParse({
      name: "Pack incomplet",
      price: 5000,
      planKind: "MIXED",
      validityDays: 30,
      entitlements: [{ type: "GYM_ACCESS", gymAccessMode: "UNLIMITED" }],
    });
    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });
});

describe("gym module safeguards", () => {
  it("requires correction and exceptional-access reasons", () => {
    expect(gymCheckInSchema.safeParse({ memberId: "member-1", overrideReason: "" }).success).toBe(false);
    expect(gymVisitReversalSchema.safeParse({ visitId: "visit-1", reason: "ok" }).success).toBe(false);
    expect(gymVisitReversalSchema.safeParse({ visitId: "visit-1", reason: "Double saisie" }).success).toBe(true);
  });

  it("registers separate check-in and management permissions", () => {
    expect(PERMISSIONS).toContain("gym.checkin");
    expect(PERMISSIONS).toContain("gym.manage");
  });

  it("rejects duplicate group selections in a mixed enrollment payload", () => {
    const parsed = createMemberSubscriptionSchema.safeParse({
      memberId: "member-1",
      planId: "mixed-plan-1",
      startDate: new Date("2026-07-12T08:00:00.000Z").toISOString(),
      groupIds: ["group-1", "group-1"],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts exactly one member source for access enrollment", () => {
    const newMember = {
      firstName: "Nouveau",
      lastName: "Membre",
      phone: "99123456",
      email: "",
      memberType: "ADULT" as const,
      gender: "MALE" as const,
      birthDate: "1995-01-01T00:00:00.000Z",
    };
    const base = { planId: "gym-plan", startDate: "2026-07-12T08:00:00.000Z" };
    expect(createMemberSubscriptionSchema.safeParse({ ...base, newMember }).success).toBe(true);
    expect(createMemberSubscriptionSchema.safeParse({ ...base, memberId: "member-1", newMember }).success).toBe(false);
    expect(createMemberSubscriptionSchema.safeParse(base).success).toBe(false);
  });
});
