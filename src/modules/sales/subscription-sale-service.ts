import type { Prisma, SubscriptionPlan } from "@prisma/client";

import { createSubscriptionFromPlan } from "@/lib/subscription-service";
import { recordSubscriptionPayment } from "@/modules/finance/payment-service";

type SalePlan = Pick<
  SubscriptionPlan,
  | "id"
  | "planKind"
  | "sportId"
  | "price"
  | "totalSessions"
  | "validityDays"
  | "activationPolicy"
  | "activationWindowDays"
  | "freezeAllowanceCount"
  | "freezeMaxTotalDays"
>;

export async function sellSubscription(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorId: string;
    memberId: string;
    plan: SalePlan;
    startDate: Date;
    source: string;
    amountCents?: number;
    listPriceCents?: number | null;
    discountCents?: number;
    offerApplicationId?: string | null;
    offerName?: string | null;
    paymentCents?: number;
    paymentMethod?: string | null;
    paymentNotes?: string | null;
    carryOverRemainingSessions?: boolean;
    replacesSubscriptionId?: string | null;
  },
) {
  const amount = input.amountCents ?? input.plan.price;
  const paymentCents = input.paymentCents ?? 0;
  if (!Number.isInteger(amount) || amount < 0) throw new Error("SUBSCRIPTION_AMOUNT_INVALID");
  if (!Number.isInteger(paymentCents) || paymentCents < 0) throw new Error("PAYMENT_AMOUNT_INVALID");
  if (paymentCents > amount) throw new Error("OVERPAY");

  const subscription = await createSubscriptionFromPlan(
    tx,
    {
      tenantId: input.tenantId,
      memberId: input.memberId,
      plan: input.plan,
      startDate: input.startDate,
      amountCents: amount,
      listPriceCents: input.listPriceCents,
      discountCents: input.discountCents,
      offerApplicationId: input.offerApplicationId,
      offerName: input.offerName,
      replacesSubscriptionId: input.replacesSubscriptionId,
    },
    { carryOverRemainingSessions: input.carryOverRemainingSessions === true },
  );

  const paymentResult = paymentCents > 0
    ? await recordSubscriptionPayment(tx, {
        tenantId: input.tenantId,
        memberSubscriptionId: subscription.id,
        amount: paymentCents,
        actorId: input.actorId,
        source: input.source,
        paymentMethod: input.paymentMethod,
        notes: input.paymentNotes,
      })
    : null;

  await tx.auditLog.create({
    data: {
      tenantId: input.tenantId,
      action: "MEMBER_SUBSCRIPTION_CREATED",
      entityType: "MemberSubscription",
      entityId: subscription.id,
      userId: input.actorId,
      details: JSON.stringify({
        tenantId: input.tenantId,
        source: input.source,
        memberId: input.memberId,
        planId: input.plan.id,
        planKind: input.plan.planKind,
        sportId: input.plan.sportId,
        amount: subscription.amount,
        listPriceCents: subscription.listPriceCents,
        discountCents: subscription.discountCents,
        remainingSessions: subscription.remainingSessions,
        paymentCents,
        startDate: subscription.startDate.toISOString(),
        endDate: subscription.endDate?.toISOString() ?? null,
        activationPolicy: subscription.activationPolicy,
        activationDeadline: subscription.activationDeadline?.toISOString() ?? null,
        renewsSubscriptionId: subscription.renewsSubscriptionId,
        replacesSubscriptionId: subscription.replacesSubscriptionId,
      }),
    },
  });

  return {
    subscription,
    payment: paymentResult?.payment ?? null,
    receipt: paymentResult?.receipt ?? null,
  };
}
