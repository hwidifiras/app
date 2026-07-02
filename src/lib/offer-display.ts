import type { OfferKind } from "@prisma/client";

import { formatMoney } from "@/lib/money";
import { offerToRulesRecord, type OfferRuleSource } from "@/lib/offer-rules";
import { parseOfferRules } from "@/lib/schemas/offer";

export type OfferLike = OfferRuleSource & {
  id: string;
  name: string;
  isActive: boolean;
  sportName?: string | null;
  rules: Record<string, unknown> | string;
};

const KIND_LABELS: Record<OfferKind, string> = {
  FAMILY_BUNDLE: "Forfait famille",
  SECOND_DISCIPLINE: "2e discipline",
  PERCENT_OFF: "Réduction en %",
  FIXED_OFF: "Montant fixe offert",
};

function parseRules(offer: OfferLike): Record<string, unknown> {
  if (
    typeof offer.percentOff === "number" ||
    typeof offer.amountOffCents === "number" ||
    typeof offer.bundlePriceCents === "number"
  ) {
    return offerToRulesRecord(offer);
  }

  if (typeof offer.rules === "string") {
    try {
      return JSON.parse(offer.rules) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return offer.rules;
}

export function getOfferKindLabel(kind: OfferKind): string {
  return KIND_LABELS[kind] ?? kind;
}

export function formatOfferRulesSummary(offer: OfferLike): string {
  const rules = parseRules(offer);
  try {
    const parsed = parseOfferRules(offer.kind, rules);
    switch (offer.kind) {
      case "FAMILY_BUNDLE": {
        const r = parsed as {
          minMembers: number;
          requiresHousehold: boolean;
          bundlePriceCents: number;
          sportId?: string;
        };
        const price = formatMoney(r.bundlePriceCents);
        const foyer = r.requiresHousehold ? "foyer requis" : "sans foyer";
        const sportLabel = offer.sportName ? ` · ${offer.sportName}` : "";
        return `${r.minMembers} pers. min. · forfait ${price} · ${foyer}${sportLabel}`;
      }
      case "SECOND_DISCIPLINE":
        return `${(parsed as { percentOff: number }).percentOff} % sur la 2e discipline`;
      case "PERCENT_OFF": {
        const r = parsed as { percentOff: number; maxMembers?: number };
        return r.maxMembers
          ? `${r.percentOff} % (max ${r.maxMembers} ligne(s))`
          : `${r.percentOff} % sur chaque ligne`;
      }
      case "FIXED_OFF": {
        const r = parsed as { amountOffCents: number; maxMembers?: number };
        const amount = formatMoney(r.amountOffCents);
        return r.maxMembers ? `${amount} par ligne (max ${r.maxMembers})` : `${amount} par ligne`;
      }
      default:
        return "";
    }
  } catch {
    return "Règles invalides";
  }
}

/** Hint shown in enrollment when an offer may not apply */
export function getOfferEnrollmentHint(offer: OfferLike, lineCount: number): string | null {
  const rules = parseRules(offer);
  try {
    if (offer.kind === "FAMILY_BUNDLE") {
      const r = parseOfferRules(offer.kind, rules) as {
        minMembers: number;
        requiresHousehold: boolean;
        sportId?: string;
      };
      if (lineCount < r.minMembers) {
        return `Nécessite au moins ${r.minMembers} inscription(s) dans ce devis.`;
      }
      if (r.requiresHousehold) {
        return "Les élèves existants doivent être dans le même foyer (Paramètres fiche élève). Nouveaux élèves : même devis OK.";
      }
      if (offer.sportName) {
        return `Forfait limité à la discipline ${offer.sportName}.`;
      }
    }
    if (offer.kind === "SECOND_DISCIPLINE") {
      return "S'applique si l'élève a déjà une autre discipline active ou en prend une 2e ici.";
    }
    return null;
  } catch {
    return null;
  }
}
