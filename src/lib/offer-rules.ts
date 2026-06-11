import type { Offer, OfferKind } from "@prisma/client";

import {
  familyBundleRulesSchema,
  fixedOffRulesSchema,
  parseOfferRules,
  percentOffRulesSchema,
  secondDisciplineRulesSchema,
  type CreateOfferInput,
} from "@/lib/schemas/offer";

export type OfferRuleSource = Pick<
  Offer,
  | "kind"
  | "rules"
  | "percentOff"
  | "amountOffCents"
  | "bundlePriceCents"
  | "minMembers"
  | "requiresHousehold"
  | "maxMembers"
  | "sportId"
>;

export type ParsedOfferRules =
  | ReturnType<typeof familyBundleRulesSchema.parse>
  | ReturnType<typeof secondDisciplineRulesSchema.parse>
  | ReturnType<typeof percentOffRulesSchema.parse>
  | ReturnType<typeof fixedOffRulesSchema.parse>;

export function buildCreateOfferRules(input: CreateOfferInput): ParsedOfferRules {
  if (input.rules && Object.keys(input.rules).length > 0) {
    return parseOfferRules(input.kind, input.rules) as ParsedOfferRules;
  }

  switch (input.kind) {
    case "FAMILY_BUNDLE":
      return familyBundleRulesSchema.parse({
        minMembers: input.minMembers ?? 2,
        requiresHousehold: input.requiresHousehold ?? true,
        bundlePriceCents: input.bundlePriceCents,
        sportId: input.sportId,
      });
    case "SECOND_DISCIPLINE":
      return secondDisciplineRulesSchema.parse({
        percentOff: input.percentOff,
      });
    case "PERCENT_OFF":
      return percentOffRulesSchema.parse({
        percentOff: input.percentOff,
        maxMembers: input.maxMembers,
      });
    case "FIXED_OFF":
      return fixedOffRulesSchema.parse({
        amountOffCents: input.amountOffCents,
        maxMembers: input.maxMembers,
      });
    default:
      throw new Error("Type d'offre invalide");
  }
}

export function offerNeedsStructuredBackfill(offer: OfferRuleSource): boolean {
  return tryStructuredRules(offer) === null;
}

export function backfillStructuredFieldsFromLegacyRules(offer: OfferRuleSource): (Pick<
  Offer,
  | "percentOff"
  | "amountOffCents"
  | "bundlePriceCents"
  | "minMembers"
  | "requiresHousehold"
  | "maxMembers"
  | "sportId"
  | "rules"
>) | null {
  try {
    const parsed = parseOfferRules(offer.kind, JSON.parse(offer.rules)) as ParsedOfferRules;
    const structured = structuredFieldsFromParsedRules(offer.kind, parsed);

    return {
      ...structured,
      rules: serializeOfferRules(parsed),
    };
  } catch {
    return null;
  }
}

function tryStructuredRules(offer: OfferRuleSource): Record<string, unknown> | null {
  switch (offer.kind) {
    case "FAMILY_BUNDLE":
      if (offer.bundlePriceCents == null || offer.minMembers == null) return null;
      return {
        minMembers: offer.minMembers,
        requiresHousehold: offer.requiresHousehold ?? true,
        bundlePriceCents: offer.bundlePriceCents,
        ...(offer.sportId ? { sportId: offer.sportId } : {}),
      };
    case "SECOND_DISCIPLINE":
      if (offer.percentOff == null) return null;
      return { percentOff: offer.percentOff };
    case "PERCENT_OFF":
      if (offer.percentOff == null) return null;
      return {
        percentOff: offer.percentOff,
        ...(offer.maxMembers != null ? { maxMembers: offer.maxMembers } : {}),
      };
    case "FIXED_OFF":
      if (offer.amountOffCents == null) return null;
      return {
        amountOffCents: offer.amountOffCents,
        ...(offer.maxMembers != null ? { maxMembers: offer.maxMembers } : {}),
      };
    default:
      return null;
  }
}

export function resolveOfferRules(offer: OfferRuleSource): ParsedOfferRules {
  const structured = tryStructuredRules(offer);
  if (structured) {
    return parseOfferRules(offer.kind, structured) as ParsedOfferRules;
  }

  return parseOfferRules(offer.kind, JSON.parse(offer.rules)) as ParsedOfferRules;
}

export function structuredFieldsFromParsedRules(
  kind: OfferKind,
  rules: ParsedOfferRules,
): Pick<
  Offer,
  | "percentOff"
  | "amountOffCents"
  | "bundlePriceCents"
  | "minMembers"
  | "requiresHousehold"
  | "maxMembers"
  | "sportId"
> {
  const empty = {
    percentOff: null,
    amountOffCents: null,
    bundlePriceCents: null,
    minMembers: null,
    requiresHousehold: null,
    maxMembers: null,
    sportId: null,
  };

  switch (kind) {
    case "FAMILY_BUNDLE": {
      const r = rules as ReturnType<typeof familyBundleRulesSchema.parse>;
      return {
        ...empty,
        bundlePriceCents: r.bundlePriceCents,
        minMembers: r.minMembers,
        requiresHousehold: r.requiresHousehold,
        sportId: r.sportId ?? null,
      };
    }
    case "SECOND_DISCIPLINE": {
      const r = rules as ReturnType<typeof secondDisciplineRulesSchema.parse>;
      return { ...empty, percentOff: r.percentOff };
    }
    case "PERCENT_OFF": {
      const r = rules as ReturnType<typeof percentOffRulesSchema.parse>;
      return {
        ...empty,
        percentOff: r.percentOff,
        maxMembers: r.maxMembers ?? null,
      };
    }
    case "FIXED_OFF": {
      const r = rules as ReturnType<typeof fixedOffRulesSchema.parse>;
      return {
        ...empty,
        amountOffCents: r.amountOffCents,
        maxMembers: r.maxMembers ?? null,
      };
    }
    default:
      return empty;
  }
}

export function serializeOfferRules(rules: ParsedOfferRules): string {
  return JSON.stringify(rules);
}

export function offerToRulesRecord(offer: OfferRuleSource): Record<string, unknown> {
  return resolveOfferRules(offer) as Record<string, unknown>;
}
