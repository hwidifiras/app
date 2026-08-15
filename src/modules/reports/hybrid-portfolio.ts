import type { PrismaClient } from "@prisma/client";

import { resolveSubscriptionEffectiveState } from "@/modules/sales/subscription-lifecycle";

export type HybridRenewalOpportunity = {
  memberId: string;
  memberName: string;
  planName: string;
  endDate: Date | null;
  remainingUnits: number | null;
};

export type HybridPortfolioReport = {
  classOnlyMembers: number;
  gymOnlyMembers: number;
  combinedMembers: number;
  mixedSalesMonth: number;
  mixedSalesAmountCents: number;
  mixedRenewalsMonth: number;
  renewalOpportunities: number;
  renewalItems: HybridRenewalOpportunity[];
};

export const EMPTY_HYBRID_PORTFOLIO_REPORT: HybridPortfolioReport = {
  classOnlyMembers: 0,
  gymOnlyMembers: 0,
  combinedMembers: 0,
  mixedSalesMonth: 0,
  mixedSalesAmountCents: 0,
  mixedRenewalsMonth: 0,
  renewalOpportunities: 0,
  renewalItems: [],
};

type PortfolioSubscription = {
  status: "DRAFT" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  activationPolicy: "FIXED_DATE" | "FIRST_USE";
  activationDeadline: Date | null;
  activatedAt: Date | null;
  startDate: Date;
  endDate: Date | null;
  plan: { name: string };
  entitlements: Array<{
    type: "CLASS_SESSIONS" | "GYM_ACCESS";
    gymAccessMode: "UNLIMITED" | "VISIT_QUOTA" | null;
    remainingUnits: number | null;
  }>;
  pauseEvents: Array<{
    id: string;
    entryType: "PAUSE" | "RESUME";
    pauseEventId: string | null;
    effectiveAt: Date;
    durationSeconds: number | null;
  }>;
  renewedBySubscription: {
    status: "DRAFT" | "ACTIVE" | "EXPIRED" | "CANCELLED";
    activationPolicy: "FIXED_DATE" | "FIRST_USE";
    activatedAt: Date | null;
    startDate: Date;
  } | null;
};

type PortfolioMember = {
  id: string;
  firstName: string;
  lastName: string;
  subscriptions: PortfolioSubscription[];
};

type MixedSale = {
  amount: number;
  renewsSubscriptionId: string | null;
};

function lowRemainingUnits(subscription: PortfolioSubscription) {
  const candidates = subscription.entitlements
    .filter((right) =>
      right.remainingUnits != null
      && (right.type === "CLASS_SESSIONS" || right.gymAccessMode === "VISIT_QUOTA"),
    )
    .map((right) => Math.max(0, right.remainingUnits as number));
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

export function buildHybridPortfolioReport(
  members: PortfolioMember[],
  mixedSales: MixedSale[],
  now = new Date(),
): HybridPortfolioReport {
  const renewalLimit = new Date(now);
  renewalLimit.setUTCDate(renewalLimit.getUTCDate() + 7);

  let classOnlyMembers = 0;
  let gymOnlyMembers = 0;
  let combinedMembers = 0;
  const renewalItems: HybridRenewalOpportunity[] = [];

  for (const member of members) {
    const resolved = member.subscriptions.map((subscription) => ({
      subscription,
      state: resolveSubscriptionEffectiveState(subscription, now),
    }));
    const current = resolved.filter((row) => row.state === "ACTIVE" || row.state === "FROZEN");
    const hasClass = current.some((row) =>
      row.subscription.entitlements.some((right) => right.type === "CLASS_SESSIONS"),
    );
    const hasGym = current.some((row) =>
      row.subscription.entitlements.some((right) => right.type === "GYM_ACCESS"),
    );

    if (hasClass && hasGym) combinedMembers += 1;
    else if (hasClass) classOnlyMembers += 1;
    else if (hasGym) gymOnlyMembers += 1;

    const opportunity = current
      .filter(({ state, subscription }) => {
        if (state !== "ACTIVE") return false;
        const renewalAlreadyQueued = subscription.renewedBySubscription
          && !["CANCELLED", "EXPIRED"].includes(subscription.renewedBySubscription.status);
        if (renewalAlreadyQueued) return false;
        const units = lowRemainingUnits(subscription);
        return Boolean(subscription.endDate && subscription.endDate <= renewalLimit)
          || (units != null && units <= 2);
      })
      .sort((left, right) => {
        const leftEnd = left.subscription.endDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const rightEnd = right.subscription.endDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return leftEnd - rightEnd;
      })[0];

    if (opportunity) {
      renewalItems.push({
        memberId: member.id,
        memberName: `${member.firstName} ${member.lastName}`,
        planName: opportunity.subscription.plan.name,
        endDate: opportunity.subscription.endDate,
        remainingUnits: lowRemainingUnits(opportunity.subscription),
      });
    }
  }

  renewalItems.sort((left, right) => {
    const leftEnd = left.endDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightEnd = right.endDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return leftEnd - rightEnd || (left.remainingUnits ?? Number.MAX_SAFE_INTEGER) - (right.remainingUnits ?? Number.MAX_SAFE_INTEGER);
  });

  return {
    classOnlyMembers,
    gymOnlyMembers,
    combinedMembers,
    mixedSalesMonth: mixedSales.length,
    mixedSalesAmountCents: mixedSales.reduce((sum, sale) => sum + sale.amount, 0),
    mixedRenewalsMonth: mixedSales.filter((sale) => Boolean(sale.renewsSubscriptionId)).length,
    renewalOpportunities: renewalItems.length,
    renewalItems: renewalItems.slice(0, 4),
  };
}

export async function loadHybridPortfolioReport(
  db: PrismaClient,
  input: { tenantId: string; monthStart: Date; monthEnd: Date; now?: Date },
) {
  const [members, mixedSales] = await Promise.all([
    db.member.findMany({
      where: { tenantId: input.tenantId, status: "ACTIVE" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        subscriptions: {
          where: { tenantId: input.tenantId, status: "ACTIVE" },
          select: {
            status: true,
            activationPolicy: true,
            activationDeadline: true,
            activatedAt: true,
            startDate: true,
            endDate: true,
            plan: { select: { name: true } },
            entitlements: {
              select: { type: true, gymAccessMode: true, remainingUnits: true },
            },
            pauseEvents: {
              select: {
                id: true,
                entryType: true,
                pauseEventId: true,
                effectiveAt: true,
                durationSeconds: true,
              },
              orderBy: { effectiveAt: "asc" },
            },
            renewedBySubscription: {
              select: {
                status: true,
                activationPolicy: true,
                activatedAt: true,
                startDate: true,
              },
            },
          },
        },
      },
    }),
    db.memberSubscription.findMany({
      where: {
        tenantId: input.tenantId,
        createdAt: { gte: input.monthStart, lt: input.monthEnd },
        status: { notIn: ["DRAFT", "CANCELLED"] },
        plan: { planKind: "MIXED" },
      },
      select: { amount: true, renewsSubscriptionId: true },
    }),
  ]);

  return buildHybridPortfolioReport(members, mixedSales, input.now);
}
