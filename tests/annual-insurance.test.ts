import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  annualInsuranceYearFor,
  calculateAnnualInsuranceCharge,
  recordAnnualInsuranceCoverage,
  resolveAnnualInsuranceCharge,
  voidSubscriptionInsuranceCoverages,
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

  it("uses active member-level coverage for both gym and martial-arts subscriptions", async () => {
    const findCoverage = vi.fn().mockResolvedValue({ coverageStart: new Date("2026-05-10T00:00:00.000Z") });
    const db = {
      clubSettings: { findFirst: vi.fn().mockResolvedValue({ annualInsuranceFeeCents: 1500 }) },
      memberInsuranceCoverage: { findFirst: findCoverage },
    } as unknown as Prisma.TransactionClient;

    await expect(resolveAnnualInsuranceCharge(db, {
      tenantId: "tenant-1",
      memberId: "member-1",
      startDate: new Date("2026-09-12T00:00:00.000Z"),
    })).resolves.toEqual({ feeCents: 0, insuranceYear: null });
    expect(findCoverage).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: "tenant-1",
        memberId: "member-1",
        status: "ACTIVE",
        coverageStart: { lte: new Date("2026-09-12T00:00:00.000Z") },
        coverageEnd: { gt: new Date("2026-09-12T00:00:00.000Z") },
      }),
    }));
  });

  it("records an external historical payment without charging the new subscription", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "coverage-1" });
    const db = { memberInsuranceCoverage: { upsert } } as unknown as Prisma.TransactionClient;
    const coverageStart = new Date("2026-05-10T00:00:00.000Z");

    await recordAnnualInsuranceCoverage(db, {
      tenantId: "tenant-1",
      memberId: "member-1",
      subscriptionId: "subscription-1",
      coverageStart,
      amountCents: 0,
    });

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        coverageStart,
        coverageEnd: new Date("2027-05-10T00:00:00.000Z"),
        amountCents: 0,
        source: "HISTORICAL",
      }),
    }));
  });

  it("voids only coverage charged by a reverted subscription", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = { memberInsuranceCoverage: { updateMany } } as unknown as Prisma.TransactionClient;

    await voidSubscriptionInsuranceCoverages(db, {
      tenantId: "tenant-1",
      subscriptionIds: ["subscription-1"],
      reason: "Erreur de saisie",
      voidedAt: new Date("2026-09-12T12:00:00.000Z"),
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        subscriptionId: { in: ["subscription-1"] },
        source: "SUBSCRIPTION",
        status: "ACTIVE",
      },
      data: {
        status: "VOIDED",
        voidedAt: new Date("2026-09-12T12:00:00.000Z"),
        voidReason: "Erreur de saisie",
      },
    });
  });
});
