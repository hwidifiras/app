import type { OfferKind } from "@prisma/client";

import { formatOfferRulesSummary } from "@/lib/offer-display";
import { resolveOfferRules } from "@/lib/offer-rules";
import { prisma } from "@/lib/prisma";

export type OfferRelevance = "high" | "medium" | "general";

export type ApplicableOffer = {
  id: string;
  name: string;
  kind: OfferKind;
  summary: string;
  hint: string | null;
  relevance: OfferRelevance;
  enrollmentHref: string;
};

export type MemberOfferContext = {
  offers: ApplicableOffer[];
  suggestedCreateKind: OfferKind | null;
  createOfferHref: string;
};

const relevanceRank: Record<OfferRelevance, number> = {
  high: 0,
  medium: 1,
  general: 2,
};

function suggestOfferKind(input: {
  activeSubscriptionCount: number;
  householdSize: number;
  offers: ApplicableOffer[];
}): OfferKind | null {
  const highSecond = input.offers.find(
    (offer) => offer.kind === "SECOND_DISCIPLINE" && offer.relevance === "high",
  );
  if (highSecond) return "SECOND_DISCIPLINE";

  const highFamily = input.offers.find(
    (offer) => offer.kind === "FAMILY_BUNDLE" && offer.relevance === "high",
  );
  if (highFamily) return "FAMILY_BUNDLE";

  if (input.activeSubscriptionCount >= 1) return "SECOND_DISCIPLINE";
  if (input.householdSize >= 2) return "FAMILY_BUNDLE";

  return null;
}

export async function getMemberOfferContext(memberId: string): Promise<MemberOfferContext> {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!member) {
    return { offers: [], suggestedCreateKind: null, createOfferHref: "/offers" };
  }

  const [householdMembers, activeSubscriptions, offers] = await Promise.all([
    prisma.householdMember.findMany({
      where: { memberId },
      select: { householdId: true },
    }),
    prisma.memberSubscription.findMany({
      where: { memberId, status: "ACTIVE" },
      select: { sportId: true, sport: { select: { name: true } } },
    }),
    prisma.offer.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      include: { sport: { select: { name: true } } },
    }),
  ]);

  const householdSize =
    householdMembers.length > 0
      ? await prisma.householdMember.count({
          where: { householdId: householdMembers[0].householdId },
        })
      : 1;

  const activeSportNames = [...new Set(activeSubscriptions.map((sub) => sub.sport.name))];

  const applicableOffers = offers
    .map((offer) => {
      const rules = resolveOfferRules(offer);
      const summary = formatOfferRulesSummary({
        id: offer.id,
        name: offer.name,
        kind: offer.kind,
        isActive: offer.isActive,
        sportName: offer.sport?.name ?? null,
        rules,
        percentOff: offer.percentOff,
        amountOffCents: offer.amountOffCents,
        bundlePriceCents: offer.bundlePriceCents,
        minMembers: offer.minMembers,
        requiresHousehold: offer.requiresHousehold,
        maxMembers: offer.maxMembers,
        sportId: offer.sportId,
      });

      let relevance: OfferRelevance = "general";
      let hint: string | null = null;

      switch (offer.kind) {
        case "SECOND_DISCIPLINE":
          if (activeSubscriptions.length >= 1) {
            relevance = "high";
            hint =
              activeSportNames.length > 0
                ? `Discipline(s) active(s) : ${activeSportNames.join(", ")}. Réduction sur une 2e discipline dans le devis.`
                : "Réduction applicable si une 2e discipline est ajoutée au devis.";
          } else {
            relevance = "medium";
            hint = "Nécessite une autre discipline active ou une 2e inscription dans le même devis.";
          }
          break;
        case "FAMILY_BUNDLE": {
          const minMembers = (rules as { minMembers: number }).minMembers;
          if (householdSize >= minMembers) {
            relevance = "high";
            hint = `Foyer de ${householdSize} membre(s) — incluez au moins ${minMembers} personnes dans le devis.`;
          } else {
            relevance = "medium";
            hint = `Forfait famille : au moins ${minMembers} inscriptions dans le devis (foyer ou nouveaux élèves).`;
          }
          if (offer.sport?.name) {
            hint = `${hint} Discipline : ${offer.sport.name}.`;
          }
          break;
        }
        case "PERCENT_OFF":
          hint = "Réduction en pourcentage sur le devis d'inscription.";
          break;
        case "FIXED_OFF":
          hint = "Montant fixe déduit par ligne du devis.";
          break;
        default:
          break;
      }

      return {
        id: offer.id,
        name: offer.name,
        kind: offer.kind,
        summary,
        hint,
        relevance,
        enrollmentHref: `/enrollment?memberId=${memberId}&offerId=${offer.id}&step=2`,
      };
    })
    .sort((a, b) => {
      const rankDiff = relevanceRank[a.relevance] - relevanceRank[b.relevance];
      if (rankDiff !== 0) return rankDiff;
      return a.name.localeCompare(b.name, "fr");
    });

  const suggestedCreateKind = suggestOfferKind({
    activeSubscriptionCount: activeSubscriptions.length,
    householdSize,
    offers: applicableOffers,
  });

  const createOfferHref = suggestedCreateKind
    ? `/offers?memberId=${memberId}&kind=${suggestedCreateKind}`
    : `/offers?memberId=${memberId}`;

  return {
    offers: applicableOffers,
    suggestedCreateKind,
    createOfferHref,
  };
}

export async function getApplicableOffersForMember(memberId: string): Promise<ApplicableOffer[]> {
  const context = await getMemberOfferContext(memberId);
  return context.offers;
}
