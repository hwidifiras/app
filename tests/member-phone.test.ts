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

  it("derives a unique phone from parent contact when child phone is omitted", () => {
    expect(
      resolveMemberPhone({
        memberType: "KID",
        parentPhone: "0699887766",
        firstName: "Lea",
        lastName: "Dupont",
      }),
    ).toBe("0699887766#lea-dupont");
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
