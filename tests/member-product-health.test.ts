import { describe, expect, it } from "vitest";

import { buildMemberProductHealth } from "@/modules/members/member-product-health";

const now = new Date("2026-08-15T10:00:00.000Z");

function mixedSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-mixed",
    amount: 8_000,
    status: "ACTIVE" as const,
    startDate: new Date("2026-08-01T00:00:00.000Z"),
    endDate: new Date("2026-08-31T00:00:00.000Z"),
    activationPolicy: "FIXED_DATE" as const,
    activationDeadline: null,
    activatedAt: new Date("2026-08-01T00:00:00.000Z"),
    plan: { name: "Combat + salle", planKind: "MIXED" as const },
    payments: [{ amount: 8_000 }],
    entitlements: [
      {
        type: "CLASS_SESSIONS" as const,
        sport: { name: "Kick-boxing" },
        remainingUnits: 5,
        grantedUnits: 8,
        gymAccessMode: null,
      },
      {
        type: "GYM_ACCESS" as const,
        sport: null,
        remainingUnits: 10,
        grantedUnits: 12,
        gymAccessMode: "VISIT_QUOTA" as const,
      },
    ],
    pauseEvents: [],
    renewedBySubscription: null,
    ...overrides,
  };
}

describe("member product health", () => {
  it("reads mixed rights from entitlement balances and recommends class assignment", () => {
    const health = buildMemberProductHealth({
      memberStatus: "ACTIVE",
      subscriptions: [mixedSubscription()],
      activeGroupsCount: 0,
      hasClassModule: true,
      hasGymModule: true,
      lastClassAttendanceAt: new Date("2026-08-12T18:00:00.000Z"),
      lastGymVisitAt: new Date("2026-08-14T08:00:00.000Z"),
      now,
    });

    expect(health).toMatchObject({
      debtCents: 0,
      currentSubscriptionCount: 1,
      subscriptionLabel: "Combat + salle",
      classRightsLabel: "Kick-boxing · 5/8",
      gymAccessLabel: "10/12 visites",
      lastActivityLabel: "Salle · 14/08/2026",
      nextActionKind: "ASSIGN_CLASS",
    });
  });

  it("prioritizes debt and ignores cancelled sales in the balance", () => {
    const health = buildMemberProductHealth({
      memberStatus: "ACTIVE",
      subscriptions: [
        mixedSubscription({ payments: [{ amount: 3_000 }] }),
        mixedSubscription({ id: "cancelled", status: "CANCELLED", payments: [] }),
      ],
      activeGroupsCount: 1,
      hasClassModule: true,
      hasGymModule: true,
      now,
    });

    expect(health.debtCents).toBe(5_000);
    expect(health.nextActionKind).toBe("COLLECT");
  });

  it("shows a whole mixed package as frozen and recommends resuming it", () => {
    const health = buildMemberProductHealth({
      memberStatus: "ACTIVE",
      subscriptions: [mixedSubscription({
        pauseEvents: [{
          id: "pause-1",
          entryType: "PAUSE",
          pauseEventId: null,
          effectiveAt: new Date("2026-08-10T00:00:00.000Z"),
          durationSeconds: null,
        }],
      })],
      activeGroupsCount: 1,
      hasClassModule: true,
      hasGymModule: true,
      now,
    });

    expect(health.classRightsLabel).toContain("gelé");
    expect(health.gymAccessLabel).toBe("Accès gelé");
    expect(health.validityLabel).toBe("Gelée depuis le 10/08/2026");
    expect(health.nextActionKind).toBe("RESUME");
  });
});
