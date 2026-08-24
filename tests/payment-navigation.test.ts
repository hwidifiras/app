import { describe, expect, it } from "vitest";

import {
  paymentNewHref,
  paymentReturnLabel,
  resolvePaymentReturnPath,
} from "@/lib/payment-navigation";

describe("payment navigation", () => {
  it("keeps valid same-app return paths and their query context", () => {
    expect(resolvePaymentReturnPath("/?view=reception")).toBe("/?view=reception");
    expect(resolvePaymentReturnPath("/members/member-1#subscriptions")).toBe(
      "/members/member-1#subscriptions",
    );
    expect(paymentReturnLabel("/members/member-1#subscriptions")).toBe("Fiche membre");
  });

  it("falls back for external, malformed, and self-looping targets", () => {
    for (const target of [
      "https://example.com",
      "//example.com/path",
      "/\\example.com",
      "/payments/new",
      "/payments/new?memberId=member-1",
      "/..//example.com",
      "/%2e%2e//example.com",
      "/bad%0Apath",
      "/bad\u0000path",
      "%2F%2Fexample.com",
    ]) {
      expect(resolvePaymentReturnPath(target), target).toBe("/payments");
    }
  });

  it("builds one encoded payment URL for all entry points", () => {
    expect(
      paymentNewHref({
        memberId: "member-1",
        memberSubscriptionId: "subscription-1",
        returnTo: "/members/member-1#subscriptions",
      }),
    ).toBe(
      "/payments/new?memberId=member-1&memberSubscriptionId=subscription-1&returnTo=%2Fmembers%2Fmember-1%23subscriptions",
    );
  });
});
