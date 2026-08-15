import type { OfferKind, OfferPlanScope, PlanKind } from "@prisma/client";

export type SinglePlanOffer = {
  id: string;
  name: string;
  kind: OfferKind;
  planScope: OfferPlanScope;
  isActive: boolean;
  percentOff: number | null;
  amountOffCents: number | null;
  sportId: string | null;
};

export type SinglePlanOfferQuote = {
  offerId: string | null;
  offerName: string | null;
  listPriceCents: number;
  discountCents: number;
  finalAmountCents: number;
};

function scopeMatchesPlan(scope: OfferPlanScope, planKind: PlanKind) {
  return scope === "ALL" || scope === planKind;
}

export function quoteSinglePlanOffer(
  plan: { price: number; planKind: PlanKind; sportId?: string | null },
  offer?: SinglePlanOffer | null,
): SinglePlanOfferQuote {
  if (!offer) {
    return {
      offerId: null,
      offerName: null,
      listPriceCents: plan.price,
      discountCents: 0,
      finalAmountCents: plan.price,
    };
  }
  if (!offer.isActive || !scopeMatchesPlan(offer.planScope, plan.planKind)) {
    throw new Error("OFFER_NOT_APPLICABLE");
  }
  if (offer.kind !== "PERCENT_OFF" && offer.kind !== "FIXED_OFF") {
    throw new Error("OFFER_REQUIRES_MULTI_LINE_ENROLLMENT");
  }
  if (offer.sportId && (plan.planKind !== "CLASS" || plan.sportId !== offer.sportId)) {
    throw new Error("OFFER_SPORT_NOT_APPLICABLE");
  }

  const discountCents = offer.kind === "PERCENT_OFF"
    ? Math.round(plan.price * Math.max(0, Math.min(100, offer.percentOff ?? 0)) / 100)
    : Math.min(plan.price, Math.max(0, offer.amountOffCents ?? 0));

  return {
    offerId: offer.id,
    offerName: offer.name,
    listPriceCents: plan.price,
    discountCents,
    finalAmountCents: Math.max(0, plan.price - discountCents),
  };
}
