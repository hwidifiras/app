import { describe, expect, it } from "vitest";

import {
  getMemberAvatarHue,
  getMemberInitials,
  paymentProgressPercent,
} from "@/lib/member-avatar";

describe("member avatar helpers", () => {
  it("builds initials from names", () => {
    expect(getMemberInitials("Léa", "Dupont")).toBe("LD");
  });

  it("returns a stable hue for the same seed", () => {
    expect(getMemberAvatarHue("member-1")).toBe(getMemberAvatarHue("member-1"));
  });

  it("computes payment progress safely", () => {
    expect(paymentProgressPercent(5000, 10000)).toBe(50);
    expect(paymentProgressPercent(12000, 10000)).toBe(100);
  });
});
