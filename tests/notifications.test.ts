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
    expect(notifications.some((item) => item.href === "/payments/new?memberId=member-1")).toBe(true);
    expect(notifications.some((item) => item.key === "subscription-expiry:sub-1:three-days")).toBe(true);
  });

  it("respects permissions, thresholds and read state", () => {
    const paymentKey = "payment-due:sub-1:2000";
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
});
