import type { PrismaClient } from "@prisma/client";

import { resolveSubscriptionEffectiveState } from "@/modules/sales/subscription-lifecycle";

export type GymReportRange = { from: Date; to: Date };

export function defaultGymReportRange(now = new Date()): GymReportRange {
  const to = new Date(now);
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 30);
  return { from, to };
}

export function parseGymReportRange(params: URLSearchParams, now = new Date()): GymReportRange {
  const fallback = defaultGymReportRange(now);
  const parsedFrom = params.get("from") ? new Date(`${params.get("from")}T00:00:00.000Z`) : fallback.from;
  const parsedToDate = params.get("to") ? new Date(`${params.get("to")}T00:00:00.000Z`) : fallback.to;
  if (Number.isNaN(parsedFrom.getTime()) || Number.isNaN(parsedToDate.getTime())) return fallback;
  const to = new Date(parsedToDate);
  to.setUTCDate(to.getUTCDate() + 1);
  const maxTo = new Date(parsedFrom);
  maxTo.setUTCDate(maxTo.getUTCDate() + 366);
  if (to <= parsedFrom || to > maxTo) return fallback;
  return { from: parsedFrom, to };
}

export async function getGymReportSnapshot(
  db: PrismaClient,
  input: { tenantId: string; range: GymReportRange; now?: Date },
) {
  const now = input.now ?? new Date();
  const expiringBefore = new Date(now);
  expiringBefore.setUTCDate(expiringBefore.getUTCDate() + 7);
  const [visits, attempts, subscriptions, periodSales] = await Promise.all([
    db.gymVisit.findMany({
      where: {
        tenantId: input.tenantId,
        entryType: "CHECK_IN",
        checkedAt: { gte: input.range.from, lt: input.range.to },
      },
      select: { overrideReason: true, corrections: { where: { entryType: "REVERSAL" }, select: { id: true } } },
    }),
    db.gymAccessAttempt.findMany({
      where: { tenantId: input.tenantId, occurredAt: { gte: input.range.from, lt: input.range.to } },
      select: { outcome: true, failureCode: true },
    }),
    db.memberSubscription.findMany({
      where: { tenantId: input.tenantId, entitlements: { some: { type: "GYM_ACCESS" } } },
      select: {
        id: true,
        amount: true,
        startDate: true,
        endDate: true,
        status: true,
        activationPolicy: true,
        activationDeadline: true,
        activatedAt: true,
        payments: { select: { amount: true } },
        pauseEvents: { orderBy: { effectiveAt: "asc" } },
        renewedBySubscription: {
          select: { status: true, activationPolicy: true, activatedAt: true, startDate: true },
        },
      },
    }),
    db.memberSubscription.findMany({
      where: {
        tenantId: input.tenantId,
        createdAt: { gte: input.range.from, lt: input.range.to },
        status: { notIn: ["DRAFT", "CANCELLED"] },
        entitlements: { some: { type: "GYM_ACCESS" } },
      },
      select: { id: true, amount: true, renewsSubscriptionId: true },
    }),
  ]);

  const effective = subscriptions.map((subscription) => ({
    subscription,
    state: resolveSubscriptionEffectiveState(subscription, now),
    paid: subscription.payments.reduce((sum, payment) => sum + payment.amount, 0),
  }));
  const admittedVisits = visits.filter((visit) => visit.corrections.length === 0);
  const deniedAttempts = attempts.filter((attempt) => attempt.outcome === "DENIED");
  const denialsByCode = deniedAttempts.reduce<Record<string, number>>((result, attempt) => {
    const code = attempt.failureCode || "ACCESS_DENIED";
    result[code] = (result[code] ?? 0) + 1;
    return result;
  }, {});

  return {
    visits: admittedVisits.length,
    overrides: attempts.filter((attempt) => attempt.outcome === "EXCEPTIONAL_ALLOWED").length,
    denials: deniedAttempts.length,
    denialsByCode,
    activePasses: effective.filter((row) => row.state === "ACTIVE").length,
    pendingActivationPasses: effective.filter((row) => row.state === "PENDING_ACTIVATION").length,
    frozenPasses: effective.filter((row) => row.state === "FROZEN").length,
    expiringPasses: effective.filter((row) =>
      row.state === "ACTIVE"
      && row.subscription.endDate
      && row.subscription.endDate >= now
      && row.subscription.endDate <= expiringBefore,
    ).length,
    unpaidPasses: effective.filter((row) =>
      ["ACTIVE", "FROZEN", "PENDING_ACTIVATION", "SCHEDULED"].includes(row.state)
      && row.subscription.amount > row.paid,
    ).length,
    sales: periodSales.length,
    salesAmount: periodSales.reduce((sum, subscription) => sum + subscription.amount, 0),
    renewals: periodSales.filter((subscription) => Boolean(subscription.renewsSubscriptionId)).length,
  };
}
