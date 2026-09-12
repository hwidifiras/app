import { describe, expect, it } from "vitest";

import {
  annualInsuranceYearFor,
  calculateAnnualInsuranceCharge,
} from "@/lib/annual-insurance";

describe("annual insurance", () => {
  const startDate = new Date("2026-09-12T00:00:00.000Z");

  it("charges the configured fee for the first subscription of the year", () => {
    expect(calculateAnnualInsuranceCharge({
      configuredFeeCents: 3000,
      alreadyInsured: false,
      startDate,
    })).toEqual({ feeCents: 3000, insuranceYear: 2026 });
  });

  it("does not charge a second subscription in the same year", () => {
    expect(calculateAnnualInsuranceCharge({
      configuredFeeCents: 3000,
      alreadyInsured: true,
      startDate,
    })).toEqual({ feeCents: 0, insuranceYear: null });
  });

  it("uses the subscription start year and supports disabling the fee", () => {
    expect(annualInsuranceYearFor(new Date("2027-01-01T00:00:00.000Z"))).toBe(2027);
    expect(calculateAnnualInsuranceCharge({
      configuredFeeCents: 0,
      alreadyInsured: false,
      startDate,
    })).toEqual({ feeCents: 0, insuranceYear: null });
  });
});
