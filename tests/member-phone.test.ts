import { describe, expect, it } from "vitest";

import { resolveMemberPhone } from "@/lib/member-phone";

describe("resolveMemberPhone", () => {
  it("uses the child phone when provided", () => {
    expect(
      resolveMemberPhone({
        memberType: "KID",
        phone: "0611223344",
        parentPhone: "0699887766",
        firstName: "Lea",
        lastName: "Dupont",
      }),
    ).toBe("0611223344");
  });

  it("stores no child phone when it is omitted and the parent contact is present", () => {
    expect(
      resolveMemberPhone({
        memberType: "KID",
        parentPhone: "0699887766",
        firstName: "Lea",
        lastName: "Dupont",
      }),
    ).toBeNull();
  });

  it("stores a shared parent number only as the parent contact", () => {
    expect(
      resolveMemberPhone({
        memberType: "KID",
        phone: "98 123 456",
        parentPhone: "+216 98 123 456",
        firstName: "Frere 1",
        lastName: "Ghribi",
      }),
    ).toBeNull();
  });

  it("requires a direct phone for adults", () => {
    expect(() =>
      resolveMemberPhone({
        memberType: "ADULT",
        firstName: "Adult",
        lastName: "Member",
      }),
    ).toThrow("PHONE_REQUIRED");
  });
});
