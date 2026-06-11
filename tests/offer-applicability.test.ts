import { beforeEach, describe, expect, it } from "vitest";

import { getMemberOfferContext } from "@/lib/offer-applicability";
import { prisma } from "@/lib/prisma";

async function minimalMemberFixture() {
  const sport = await prisma.sport.create({ data: { name: `Sport-${Date.now()}` } });
  const coach = await prisma.coach.create({
    data: {
      firstName: "Coach",
      lastName: "Test",
      phone: `coach-${Date.now()}`,
      sportId: sport.id,
    },
  });
  const adult = await prisma.member.create({
    data: {
      firstName: "Alex",
      lastName: "Test",
      phone: `member-${Date.now()}`,
      memberType: "ADULT",
    },
  });
  const kid = await prisma.member.create({
    data: {
      firstName: "Lina",
      lastName: "Test",
      phone: `kid-${Date.now()}`,
      memberType: "KID",
      parentName: "Parent Test",
      parentPhone: `parent-${Date.now()}`,
    },
  });
  const plan = await prisma.subscriptionPlan.create({
    data: {
      name: `Plan test ${Date.now()}`,
      price: 10000,
      totalSessions: 10,
      validityDays: 30,
      sportId: sport.id,
    },
  });

  return { sport, coach, adult, kid, plan };
}

describe("offer applicability", () => {
  beforeEach(async () => {
    await prisma.offerApplication.deleteMany();
    await prisma.offer.deleteMany();
  });

  it("prioritizes second discipline offers when member has an active subscription", async () => {
    const fx = await minimalMemberFixture();

    await prisma.memberSubscription.create({
      data: {
        memberId: fx.adult.id,
        planId: fx.plan.id,
        sportId: fx.sport.id,
        amount: fx.plan.price,
        remainingSessions: 8,
        status: "ACTIVE",
        startDate: new Date(),
      },
    });

    await prisma.offer.create({
      data: {
        name: "2e art",
        kind: "SECOND_DISCIPLINE",
        rules: JSON.stringify({ percentOff: 20 }),
        percentOff: 20,
      },
    });

    await prisma.offer.create({
      data: {
        name: "Promo générale",
        kind: "PERCENT_OFF",
        rules: JSON.stringify({ percentOff: 5 }),
        percentOff: 5,
      },
    });

    const context = await getMemberOfferContext(fx.adult.id);
    expect(context.offers[0]?.kind).toBe("SECOND_DISCIPLINE");
    expect(context.offers[0]?.relevance).toBe("high");
    expect(context.offers[0]?.enrollmentHref).toContain(fx.adult.id);
    expect(context.suggestedCreateKind).toBe("SECOND_DISCIPLINE");
    expect(context.createOfferHref).toContain("kind=SECOND_DISCIPLINE");
  });

  it("marks family bundle as highly relevant when household is large enough", async () => {
    const fx = await minimalMemberFixture();
    const household = await prisma.household.create({ data: { label: "Famille" } });
    await prisma.householdMember.createMany({
      data: [
        { householdId: household.id, memberId: fx.adult.id, relationship: "PARENT" },
        { householdId: household.id, memberId: fx.kid.id, relationship: "CHILD" },
      ],
    });

    await prisma.offer.create({
      data: {
        name: "Famille",
        kind: "FAMILY_BUNDLE",
        rules: JSON.stringify({ minMembers: 2, requiresHousehold: true, bundlePriceCents: 18000 }),
        bundlePriceCents: 18000,
        minMembers: 2,
        requiresHousehold: true,
      },
    });

    const context = await getMemberOfferContext(fx.adult.id);
    const family = context.offers.find((offer) => offer.kind === "FAMILY_BUNDLE");
    expect(family?.relevance).toBe("high");
    expect(family?.hint).toMatch(/foyer/i);
    expect(context.suggestedCreateKind).toBe("FAMILY_BUNDLE");
  });
});
