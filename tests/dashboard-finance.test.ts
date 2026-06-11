import { describe, expect, it } from "vitest";

import {
  computeFinanceSnapshot,
  computeMemberDebts,
  type SubscriptionFinanceRow,
} from "@/lib/dashboard-finance";

const now = new Date("2026-06-11T12:00:00.000Z");

function sub(overrides: Partial<SubscriptionFinanceRow> & Pick<SubscriptionFinanceRow, "id" | "memberId">): SubscriptionFinanceRow {
  return {
    amount: 10000,
    status: "ACTIVE",
    startDate: new Date("2026-06-01T00:00:00.000Z"),
    endDate: new Date("2026-07-01T00:00:00.000Z"),
    member: { firstName: "Jean", lastName: "Dupont", phone: "0612345678" },
    payments: [],
    ...overrides,
  };
}

describe("computeMemberDebts", () => {
  it("aggregates outstanding balances per member on active subscriptions", () => {
    const rows = computeMemberDebts(
      [
        sub({
          id: "s1",
          memberId: "m1",
          payments: [{ amount: 4000 }],
        }),
        sub({
          id: "s2",
          memberId: "m1",
          amount: 5000,
          payments: [{ amount: 5000 }],
        }),
      ],
      { debtThresholdCents: 0, now },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.totalDebt).toBe(6000);
    expect(rows[0]?.subscriptions).toBe(1);
    expect(rows[0]?.partialPaid).toBe(true);
  });

  it("respects the club debt threshold", () => {
    expect(
      computeMemberDebts(
        [sub({ id: "s1", memberId: "m1", amount: 2000, payments: [{ amount: 500 }] })],
        { debtThresholdCents: 2000, now },
      ),
    ).toHaveLength(0);

    expect(
      computeMemberDebts(
        [sub({ id: "s1", memberId: "m1", amount: 5000, payments: [{ amount: 2000 }] })],
        { debtThresholdCents: 2000, now },
      ),
    ).toHaveLength(1);
  });
});

describe("computeFinanceSnapshot", () => {
  it("computes collection rate, debtors and expiring subscriptions", () => {
    const snapshot = computeFinanceSnapshot(
      [
        sub({
          id: "s1",
          memberId: "m1",
          amount: 10000,
          payments: [{ amount: 7000 }],
          endDate: new Date("2026-06-15T00:00:00.000Z"),
        }),
        sub({
          id: "s2",
          memberId: "m2",
          amount: 8000,
          payments: [{ amount: 8000 }],
          endDate: new Date("2026-08-01T00:00:00.000Z"),
        }),
      ],
      { now },
    );

    expect(snapshot.totalOutstandingCents).toBe(3000);
    expect(snapshot.debtorsCount).toBe(1);
    expect(snapshot.partialPayersCount).toBe(1);
    expect(snapshot.expiringIn7Days).toBe(1);
    expect(snapshot.collectionRatePercent).toBe(83);
    expect(snapshot.activeSubscriptionsCount).toBe(2);
  });
});
