import { describe, expect, it } from "vitest";

import {
  buildNotifications,
  type NotificationSubscriptionRow,
} from "@/lib/notifications";

const now = new Date("2026-06-12T08:00:00.000Z");

function subscription(
  overrides: Partial<NotificationSubscriptionRow> = {},
): NotificationSubscriptionRow {
  return {
    id: "sub-1",
    amount: 10_000,
    endDate: new Date("2026-06-15T00:00:00.000Z"),
    member: {
      id: "member-1",
      firstName: "Jazir",
      lastName: "Kke",
    },
    plan: { name: "12 séances" },
    payments: [],
    ...overrides,
  };
}

describe("buildNotifications", () => {
  it("creates payment and expiration alerts with direct actions", () => {
    const notifications = buildNotifications([subscription()], {
      now,
      includePayments: true,
      includeExpirations: true,
      debtThresholdCents: 0,
    });

    expect(notifications).toHaveLength(2);
    expect(notifications[0]?.severity).toBe("critical");
    expect(
      notifications.some(
        (item) =>
          item.href === "/payments/new?memberId=member-1&returnTo=%2F",
      ),
    ).toBe(true);
    expect(notifications.some((item) => item.key === "subscription-expiry:sub-1:three-days")).toBe(true);
  });

  it("respects permissions, thresholds and read state", () => {
    const paymentKey = "payment-due:sub-1:partial";
    const notifications = buildNotifications(
      [subscription({ payments: [{ amount: 8_000 }], endDate: null })],
      {
        now,
        includePayments: true,
        includeExpirations: false,
        debtThresholdCents: 1_500,
        readKeys: new Set([paymentKey]),
      },
    );

    expect(notifications).toEqual([
      expect.objectContaining({
        key: paymentKey,
        read: true,
        severity: "warning",
      }),
    ]);

    expect(
      buildNotifications([subscription({ payments: [{ amount: 9_000 }], endDate: null })], {
        now,
        includePayments: true,
        includeExpirations: false,
        debtThresholdCents: 1_500,
      }),
    ).toHaveLength(0);
  });

  it("raises new expiration stages at J-7, J-3 and J-0", () => {
    const atSevenDays = buildNotifications(
      [subscription({ endDate: new Date("2026-06-19T00:00:00.000Z"), amount: 0 })],
      {
        now,
        includePayments: false,
        includeExpirations: true,
        debtThresholdCents: 0,
      },
    );
    const today = buildNotifications(
      [subscription({ endDate: new Date("2026-06-12T00:00:00.000Z"), amount: 0 })],
      {
        now,
        includePayments: false,
        includeExpirations: true,
        debtThresholdCents: 0,
      },
    );

    expect(atSevenDays[0]?.key).toBe("subscription-expiry:sub-1:seven-days");
    expect(today[0]?.key).toBe("subscription-expiry:sub-1:today");
    expect(today[0]?.severity).toBe("critical");
  });

  it("prioritizes overdue sessions and links directly to late check-in", () => {
    const notifications = buildNotifications([], {
      now,
      includePayments: false,
      includeExpirations: false,
      debtThresholdCents: 0,
      overdueSessions: [
        {
          id: "session-1",
          groupName: "BJJ Adultes",
          sessionDate: new Date("2026-06-11T00:00:00.000Z"),
          endTime: "19:30",
          unmarkedCount: 2,
        },
      ],
    });

    expect(notifications).toEqual([
      expect.objectContaining({
        kind: "SESSION_FINALIZATION",
        severity: "critical",
        href: "/attendance/today?sessionId=session-1",
      }),
    ]);
  });

  it("keeps severity ahead of read state and keeps alert keys stable within a stage", () => {
    const criticalKey = "payment-due:sub-critical:unpaid";
    const ordered = buildNotifications(
      [
        subscription({
          id: "sub-critical",
          endDate: null,
          payments: [],
        }),
        subscription({
          id: "sub-info",
          amount: 0,
          endDate: new Date("2026-06-19T00:00:00.000Z"),
        }),
      ],
      {
        now,
        includePayments: true,
        includeExpirations: true,
        debtThresholdCents: 0,
        readKeys: new Set([criticalKey]),
      },
    );

    expect(ordered[0]).toEqual(
      expect.objectContaining({ key: criticalKey, severity: "critical", read: true }),
    );
    expect(ordered[1]?.severity).toBe("info");

    const firstPartial = buildNotifications(
      [subscription({ endDate: null, payments: [{ amount: 1_000 }] })],
      { now, includePayments: true, includeExpirations: false, debtThresholdCents: 0 },
    );
    const secondPartial = buildNotifications(
      [subscription({ endDate: null, payments: [{ amount: 2_000 }] })],
      { now, includePayments: true, includeExpirations: false, debtThresholdCents: 0 },
    );

    expect(firstPartial[0]?.key).toBe("payment-due:sub-1:partial");
    expect(secondPartial[0]?.key).toBe(firstPartial[0]?.key);
  });
});
