import { describe, expect, it } from "vitest";

import { buildHybridPortfolioReport } from "@/modules/reports/hybrid-portfolio";

const now = new Date("2026-08-15T10:00:00.000Z");
type TestSubscription = Parameters<typeof buildHybridPortfolioReport>[0][number]["subscriptions"][number];

function subscription(
  name: string,
  rights: Array<{
    type: "CLASS_SESSIONS" | "GYM_ACCESS";
    gymAccessMode?: "UNLIMITED" | "VISIT_QUOTA" | null;
    remainingUnits?: number | null;
  }>,
  endDate = new Date("2026-09-15T00:00:00.000Z"),
): TestSubscription {
  return {
    status: "ACTIVE" as const,
    activationPolicy: "FIXED_DATE" as const,
    activationDeadline: null,
    activatedAt: new Date("2026-08-01T00:00:00.000Z"),
    startDate: new Date("2026-08-01T00:00:00.000Z"),
    endDate,
    plan: { name },
    entitlements: rights.map((right) => ({
      type: right.type,
      gymAccessMode: right.gymAccessMode ?? null,
      remainingUnits: right.remainingUnits ?? null,
    })),
    pauseEvents: [],
    renewedBySubscription: null,
  };
}

describe("hybrid portfolio", () => {
  it("deduplicates members into class, gym and combined cohorts", () => {
    const report = buildHybridPortfolioReport(
      [
        {
          id: "class-member",
          firstName: "Cours",
          lastName: "Seul",
          subscriptions: [subscription("Cours", [{ type: "CLASS_SESSIONS", remainingUnits: 6 }])],
        },
        {
          id: "gym-member",
          firstName: "Salle",
          lastName: "Seule",
          subscriptions: [subscription("Salle", [{ type: "GYM_ACCESS", gymAccessMode: "UNLIMITED" }])],
        },
        {
          id: "mixed-member",
          firstName: "Pack",
          lastName: "Mixte",
          subscriptions: [subscription("Mixte", [
            { type: "CLASS_SESSIONS", remainingUnits: 1 },
            { type: "GYM_ACCESS", gymAccessMode: "VISIT_QUOTA", remainingUnits: 8 },
          ])],
        },
      ],
      [
        { amount: 10_000, renewsSubscriptionId: null },
        { amount: 12_000, renewsSubscriptionId: "old-subscription" },
      ],
      now,
    );

    expect(report).toMatchObject({
      classOnlyMembers: 1,
      gymOnlyMembers: 1,
      combinedMembers: 1,
      mixedSalesMonth: 2,
      mixedSalesAmountCents: 22_000,
      mixedRenewalsMonth: 1,
      renewalOpportunities: 1,
    });
    expect(report.renewalItems[0]?.memberId).toBe("mixed-member");
  });

  it("does not flag a subscription whose renewal is already queued", () => {
    const expiring = subscription(
      "Mixte à renouveler",
      [{ type: "GYM_ACCESS", gymAccessMode: "VISIT_QUOTA", remainingUnits: 1 }],
      new Date("2026-08-18T00:00:00.000Z"),
    );
    expiring.renewedBySubscription = {
      status: "DRAFT",
      activationPolicy: "FIXED_DATE",
      activatedAt: null,
      startDate: new Date("2026-08-19T00:00:00.000Z"),
    };

    const report = buildHybridPortfolioReport([
      { id: "queued", firstName: "Déjà", lastName: "Renouvelé", subscriptions: [expiring] },
    ], [], now);

    expect(report.renewalOpportunities).toBe(0);
  });
});
