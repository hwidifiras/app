import { describe, expect, it } from "vitest";

import {
  registrationOnlyNavItemIsAllowed,
  registrationOnlyPageIsAllowed,
} from "@/lib/registration-only-workspace";

describe("registration-only workspace", () => {
  it("keeps enrollment, member records, receipts, and account access", () => {
    expect(registrationOnlyPageIsAllowed("/enrollment")).toBe(true);
    expect(registrationOnlyPageIsAllowed("/members/member-1")).toBe(true);
    expect(registrationOnlyPageIsAllowed("/receipts/receipt-1")).toBe(true);
    expect(registrationOnlyPageIsAllowed("/settings/account")).toBe(true);
  });

  it("removes pointage and operational administration pages", () => {
    expect(registrationOnlyPageIsAllowed("/")).toBe(false);
    expect(registrationOnlyPageIsAllowed("/attendance/today")).toBe(false);
    expect(registrationOnlyPageIsAllowed("/gym/check-in")).toBe(false);
    expect(registrationOnlyPageIsAllowed("/sessions")).toBe(false);
    expect(registrationOnlyPageIsAllowed("/settings/club")).toBe(false);
  });

  it("shows only enrollment, students, and account in navigation", () => {
    expect(registrationOnlyNavItemIsAllowed("/enrollment")).toBe(true);
    expect(registrationOnlyNavItemIsAllowed("/members")).toBe(true);
    expect(registrationOnlyNavItemIsAllowed("/settings/account")).toBe(true);
    expect(registrationOnlyNavItemIsAllowed("/payments")).toBe(false);
    expect(registrationOnlyNavItemIsAllowed("/attendance/today")).toBe(false);
  });
});
