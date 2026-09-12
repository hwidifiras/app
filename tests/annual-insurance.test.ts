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
      lastInsuranceStartDate: null,
      startDate,
    })).toEqual({ feeCents: 3000, insuranceYear: 2026 });
  });

  it("does not charge again before the twelve-month anniversary", () => {
    expect(calculateAnnualInsuranceCharge({
      configuredFeeCents: 3000,
      lastInsuranceStartDate: new Date("2026-01-15T00:00:00.000Z"),
      startDate,
    })).toEqual({ feeCents: 0, insuranceYear: null });
  });

  it("uses the subscription start year and supports disabling the fee", () => {
    expect(annualInsuranceYearFor(new Date("2027-01-01T00:00:00.000Z"))).toBe(2027);
    expect(calculateAnnualInsuranceCharge({
      configuredFeeCents: 0,
      lastInsuranceStartDate: null,
      startDate,
    })).toEqual({ feeCents: 0, insuranceYear: null });
  });

  it("charges again on the twelve-month anniversary instead of January 1", () => {
    expect(calculateAnnualInsuranceCharge({
      configuredFeeCents: 1500,
      lastInsuranceStartDate: new Date("2026-08-10T00:00:00.000Z"),
      startDate: new Date("2027-08-10T00:00:00.000Z"),
    })).toEqual({ feeCents: 1500, insuranceYear: 2027 });
    expect(calculateAnnualInsuranceCharge({
      configuredFeeCents: 1500,
      lastInsuranceStartDate: new Date("2026-12-20T00:00:00.000Z"),
      startDate: new Date("2027-01-05T00:00:00.000Z"),
    })).toEqual({ feeCents: 0, insuranceYear: null });
  });
});
