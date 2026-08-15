import { describe, expect, it } from "vitest";

import { quoteSinglePlanOffer } from "@/modules/sales/single-plan-offer";

const mixedPlan = { price: 12_000, planKind: "MIXED" as const, sportId: null };

function offer(overrides: Partial<Parameters<typeof quoteSinglePlanOffer>[1]> = {}) {
  return {
    id: "offer",
    name: "Lancement",
    kind: "PERCENT_OFF" as const,
    planScope: "MIXED" as const,
    isActive: true,
    percentOff: 10,
    amountOffCents: null,
    sportId: null,
    ...overrides,
  };
}

describe("single-plan offer quote", () => {
  it("calculates percent and fixed discounts for one package", () => {
    expect(quoteSinglePlanOffer(mixedPlan, offer())).toMatchObject({
      listPriceCents: 12_000,
      discountCents: 1_200,
      finalAmountCents: 10_800,
      offerName: "Lancement",
    });
    expect(quoteSinglePlanOffer(mixedPlan, offer({
      kind: "FIXED_OFF",
      percentOff: null,
      amountOffCents: 2_500,
    }))).toMatchObject({ discountCents: 2_500, finalAmountCents: 9_500 });
  });

  it("rejects multi-line, wrong-scope and discipline-specific offers", () => {
    expect(() => quoteSinglePlanOffer(mixedPlan, offer({ kind: "FAMILY_BUNDLE" })))
      .toThrow("OFFER_REQUIRES_MULTI_LINE_ENROLLMENT");
    expect(() => quoteSinglePlanOffer(mixedPlan, offer({ planScope: "GYM" })))
      .toThrow("OFFER_NOT_APPLICABLE");
    expect(() => quoteSinglePlanOffer(mixedPlan, offer({ sportId: "sport-a" })))
      .toThrow("OFFER_SPORT_NOT_APPLICABLE");
  });
});
