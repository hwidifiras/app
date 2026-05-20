import type { OfferKind } from "@prisma/client";

import { parseOfferRules } from "@/lib/schemas/offer";

export type OfferLike = {
  id: string;
  name: string;
  kind: OfferKind;
  isActive: boolean;
  rules: Record<string, unknown> | string;
};

const KIND_LABELS: Record<OfferKind, string> = {
  FAMILY_BUNDLE: "Forfait famille",
  SECOND_DISCIPLINE: "2e discipline",
  PERCENT_OFF: "Réduction en %",
  FIXED_OFF: "Montant fixe offert",
};

function parseRules(offer: OfferLike): Record<string, unknown> {
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
        const r = parsed as { minMembers: number; requiresHousehold: boolean; bundlePriceCents: number };
        const price = (r.bundlePriceCents / 100).toFixed(2).replace(".", ",") + " €";
        const foyer = r.requiresHousehold ? "foyer requis" : "sans foyer";
        return `${r.minMembers} pers. min. · forfait ${price} · ${foyer}`;
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
        const euros = (r.amountOffCents / 100).toFixed(2).replace(".", ",") + " €";
        return r.maxMembers ? `${euros} par ligne (max ${r.maxMembers})` : `${euros} par ligne`;
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
      const r = parseOfferRules(offer.kind, rules) as { minMembers: number; requiresHousehold: boolean };
      if (lineCount < r.minMembers) {
        return `Nécessite au moins ${r.minMembers} inscription(s) dans ce devis.`;
      }
      if (r.requiresHousehold) {
        return "Les élèves existants doivent être dans le même foyer (Paramètres fiche élève). Nouveaux élèves : même devis OK.";
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
