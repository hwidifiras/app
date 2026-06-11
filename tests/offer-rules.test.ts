import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import {
  buildCreateOfferRules,
  backfillStructuredFieldsFromLegacyRules,
  offerNeedsStructuredBackfill,
  resolveOfferRules,
  structuredFieldsFromParsedRules,
} from "@/lib/offer-rules";

describe("offer rules resolver", () => {
  it("reads structured columns when present", async () => {
    const offer = await prisma.offer.create({
      data: {
        name: "Test structuré",
        kind: "PERCENT_OFF",
        rules: JSON.stringify({ percentOff: 99 }),
        percentOff: 15,
        maxMembers: 2,
      },
    });

    const resolved = resolveOfferRules(offer);
    expect(resolved).toEqual({ percentOff: 15, maxMembers: 2 });
  });

  it("falls back to legacy JSON when structured columns are absent", async () => {
    const offer = await prisma.offer.create({
      data: {
        name: "Test legacy",
        kind: "FIXED_OFF",
        rules: JSON.stringify({ amountOffCents: 500, maxMembers: 1 }),
      },
    });

    const resolved = resolveOfferRules(offer);
    expect(resolved).toEqual({ amountOffCents: 500, maxMembers: 1 });
  });

  it("builds create payload and structured storage fields", () => {
    const parsed = buildCreateOfferRules({
      name: "Famille",
      kind: "FAMILY_BUNDLE",
      minMembers: 2,
      requiresHousehold: true,
      bundlePriceCents: 18000,
      sportId: "sport-1",
    });

    const structured = structuredFieldsFromParsedRules("FAMILY_BUNDLE", parsed);
    expect(structured.bundlePriceCents).toBe(18000);
    expect(structured.minMembers).toBe(2);
    expect(structured.requiresHousehold).toBe(true);
    expect(structured.sportId).toBe("sport-1");
  });

  it("backfills structured columns from legacy JSON rules", async () => {
    const offer = await prisma.offer.create({
      data: {
        name: "Legacy only",
        kind: "PERCENT_OFF",
        rules: JSON.stringify({ percentOff: 12, maxMembers: 3 }),
      },
    });

    expect(offerNeedsStructuredBackfill(offer)).toBe(true);

    const backfill = backfillStructuredFieldsFromLegacyRules(offer);
    expect(backfill).toEqual({
      percentOff: 12,
      amountOffCents: null,
      bundlePriceCents: null,
      minMembers: null,
      requiresHousehold: null,
      maxMembers: 3,
      sportId: null,
      rules: JSON.stringify({ percentOff: 12, maxMembers: 3 }),
    });

    const updated = await prisma.offer.update({
      where: { id: offer.id },
      data: backfill!,
    });

    expect(offerNeedsStructuredBackfill(updated)).toBe(false);
    expect(resolveOfferRules(updated)).toEqual({ percentOff: 12, maxMembers: 3 });
  });
});
