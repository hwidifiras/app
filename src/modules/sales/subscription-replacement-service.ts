import { randomUUID } from "node:crypto";
import type { Prisma, SubscriptionPlan } from "@prisma/client";

import { getEffectivePaymentAmount, getSubscriptionLedgerTotal } from "@/lib/payment-ledger";
import { voidReceiptForPayment } from "@/lib/receipts";
import { checkScheduleConflictForAssignmentWindow } from "@/lib/assignment-policy";
import { recordSubscriptionPayment } from "@/modules/finance/payment-service";
import { resolveSubscriptionEffectiveState } from "@/modules/sales/subscription-lifecycle";
import { sellSubscription } from "@/modules/sales/subscription-sale-service";

type ReplacementPlan = SubscriptionPlan & {
  entitlements: Array<{ type: "CLASS_SESSIONS" | "GYM_ACCESS"; sportId: string | null }>;
};

async function transferSubscriptionCredit(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorId: string;
    oldSubscriptionId: string;
    newSubscriptionId: string;
    amount: number;
    reason: string;
  },
) {
  if (input.amount === 0) return { transferReference: null, receipt: null };
  const transferReference = randomUUID();
  let remaining = input.amount;
  const originals = await tx.payment.findMany({
    where: {
      tenantId: input.tenantId,
      memberSubscriptionId: input.oldSubscriptionId,
      entryType: "PAYMENT",
    },
    orderBy: { paymentDate: "asc" },
    select: { id: true },
  });

  for (const original of originals) {
    if (remaining <= 0) break;
    const effective = await getEffectivePaymentAmount(tx, original.id, input.tenantId);
    const moved = Math.min(Math.max(0, effective), remaining);
    if (moved <= 0) continue;
    await tx.payment.create({
      data: {
        tenantId: input.tenantId,
        memberSubscriptionId: input.oldSubscriptionId,
        amount: -moved,
        entryType: "CORRECTION",
        correctsPaymentId: original.id,
        correctionReason: input.reason,
        createdById: input.actorId,
        paymentMethod: "TRANSFER",
        notes: `Transfert ${transferReference} vers ${input.newSubscriptionId}`,
      },
    });
    await voidReceiptForPayment(tx, original.id, input.reason, input.tenantId);
    remaining -= moved;
  }

  if (remaining > 0) {
    await tx.payment.create({
      data: {
        tenantId: input.tenantId,
        memberSubscriptionId: input.oldSubscriptionId,
        amount: -remaining,
        entryType: "CORRECTION",
        correctionReason: input.reason,
        createdById: input.actorId,
        paymentMethod: "TRANSFER",
        notes: `Transfert ${transferReference} vers ${input.newSubscriptionId}`,
      },
    });
  }

  const transferred = await recordSubscriptionPayment(tx, {
    tenantId: input.tenantId,
    memberSubscriptionId: input.newSubscriptionId,
    amount: input.amount,
    actorId: input.actorId,
    source: "subscription-replacement-transfer",
    paymentMethod: "TRANSFER",
    notes: `Crédit transféré depuis ${input.oldSubscriptionId} (${transferReference})`,
  });
  return { transferReference, receipt: transferred.receipt };
}

export async function replaceSubscription(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorId: string;
    subscriptionId: string;
    plan: ReplacementPlan;
    startDate: Date;
    transferCents?: number;
    groupIds?: string[];
    reason: string;
  },
) {
  const now = new Date();
  if (input.startDate > new Date(now.getTime() + 5 * 60_000)) throw new Error("REPLACEMENT_CANNOT_BE_FUTURE");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.tenantId}:subscription:${input.subscriptionId}`}))`;
  const original = await tx.memberSubscription.findFirst({
    where: { tenantId: input.tenantId, id: input.subscriptionId },
    include: {
      entitlements: { select: { type: true, sportId: true } },
      replacedBySubscription: { select: { id: true } },
      pauseEvents: { orderBy: { effectiveAt: "asc" } },
      renewedBySubscription: {
        select: { id: true, status: true, activationPolicy: true, activatedAt: true, startDate: true },
      },
    },
  });
  if (!original) throw new Error("SUBSCRIPTION_NOT_FOUND");
  if (original.status === "CANCELLED") throw new Error("SUBSCRIPTION_ALREADY_CANCELLED");
  if (original.replacedBySubscription) throw new Error("SUBSCRIPTION_ALREADY_REPLACED");
  if (resolveSubscriptionEffectiveState(original, now) === "EXPIRED") {
    throw new Error("SUBSCRIPTION_NOT_REPLACEABLE");
  }
  if (
    original.renewedBySubscription &&
    !["CANCELLED", "EXPIRED"].includes(original.renewedBySubscription.status)
  ) {
    throw new Error("SUBSCRIPTION_HAS_QUEUED_RENEWAL");
  }

  const totalPaid = await getSubscriptionLedgerTotal(tx, original.id, input.tenantId);
  const transferCents = input.transferCents ?? totalPaid;
  if (transferCents < 0 || transferCents > totalPaid) throw new Error("TRANSFER_EXCEEDS_AVAILABLE_CREDIT");
  if (transferCents !== totalPaid) throw new Error("PARTIAL_TRANSFER_NOT_SUPPORTED");
  if (transferCents > input.plan.price) throw new Error("TRANSFER_EXCEEDS_REPLACEMENT_AMOUNT");

  const classSportIds = input.plan.entitlements
    .filter((right) => right.type === "CLASS_SESSIONS" && right.sportId)
    .map((right) => right.sportId as string);
  const selectedGroups = input.groupIds?.length
    ? await tx.group.findMany({
        where: { tenantId: input.tenantId, id: { in: input.groupIds }, isActive: true },
        select: { id: true, sportId: true, capacity: true },
      })
    : [];
  if (selectedGroups.length !== (input.groupIds?.length ?? 0)) throw new Error("GROUP_NOT_FOUND");
  if (selectedGroups.some((group) => !classSportIds.includes(group.sportId))) {
    throw new Error("GROUP_PLAN_MISMATCH");
  }

  const activeAssignments = await tx.groupMember.findMany({
    where: { tenantId: input.tenantId, memberId: original.memberId, status: "ACTIVE" },
    select: { id: true, groupId: true, group: { select: { sportId: true } } },
  });
  for (const sportId of classSportIds) {
    const hasSelection = selectedGroups.some((group) => group.sportId === sportId);
    const hasExisting = activeAssignments.some((assignment) => assignment.group.sportId === sportId);
    if (!hasSelection && !hasExisting) throw new Error("CLASS_GROUP_REQUIRED");
  }
  for (const group of selectedGroups) {
    const occupied = await tx.groupMember.count({
      where: { tenantId: input.tenantId, groupId: group.id, status: "ACTIVE", NOT: { memberId: original.memberId } },
    });
    if (occupied >= group.capacity) throw new Error("GROUP_CAPACITY_REACHED");
  }

  const sale = await sellSubscription(tx, {
    tenantId: input.tenantId,
    actorId: input.actorId,
    memberId: original.memberId,
    plan: input.plan,
    startDate: input.startDate,
    source: "subscription-replacement",
    replacesSubscriptionId: original.id,
  });

  for (const group of selectedGroups) {
    const conflict = await checkScheduleConflictForAssignmentWindow(
      group.id,
      original.memberId,
      input.startDate,
      sale.subscription.endDate,
      undefined,
      tx,
    );
    if (!conflict.ok) throw new Error("GROUP_SCHEDULE_CONFLICT");
  }

  await tx.memberSubscription.update({
    where: { id: original.id },
    data: { status: "CANCELLED" },
  });

  const newSportIds = new Set(classSportIds);
  await tx.groupMember.updateMany({
    where: {
      tenantId: input.tenantId,
      memberId: original.memberId,
      status: "ACTIVE",
      group: { sportId: { notIn: [...newSportIds] } },
    },
    data: { status: "INACTIVE", endDate: input.startDate },
  });
  for (const group of selectedGroups) {
    await tx.groupMember.updateMany({
      where: {
        tenantId: input.tenantId,
        memberId: original.memberId,
        status: "ACTIVE",
        groupId: { not: group.id },
        group: { sportId: group.sportId },
      },
      data: { status: "INACTIVE", endDate: input.startDate },
    });
    await tx.groupMember.upsert({
      where: {
        tenantId_groupId_memberId: {
          tenantId: input.tenantId,
          groupId: group.id,
          memberId: original.memberId,
        },
      },
      update: { status: "ACTIVE", startDate: input.startDate, endDate: sale.subscription.endDate },
      create: {
        tenantId: input.tenantId,
        groupId: group.id,
        memberId: original.memberId,
        status: "ACTIVE",
        startDate: input.startDate,
        endDate: sale.subscription.endDate,
      },
    });
  }

  const transfer = await transferSubscriptionCredit(tx, {
    tenantId: input.tenantId,
    actorId: input.actorId,
    oldSubscriptionId: original.id,
    newSubscriptionId: sale.subscription.id,
    amount: transferCents,
    reason: input.reason,
  });
  await tx.auditLog.create({
    data: {
      tenantId: input.tenantId,
      action: "MEMBER_SUBSCRIPTION_REPLACED",
      entityType: "MemberSubscription",
      entityId: original.id,
      userId: input.actorId,
      details: JSON.stringify({
        tenantId: input.tenantId,
        originalSubscriptionId: original.id,
        replacementSubscriptionId: sale.subscription.id,
        originalPlanId: original.planId,
        replacementPlanId: input.plan.id,
        transferCents,
        transferReference: transfer.transferReference,
        reason: input.reason,
      }),
    },
  });
  return {
    originalSubscriptionId: original.id,
    replacementSubscriptionId: sale.subscription.id,
    transferredCents: transferCents,
    transferReference: transfer.transferReference,
    receipt: transfer.receipt
      ? { id: transfer.receipt.id, receiptNumber: transfer.receipt.receiptNumber }
      : null,
  };
}
