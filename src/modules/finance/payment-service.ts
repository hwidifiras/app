import type { Prisma } from "@prisma/client";

import { getSubscriptionLedgerTotal, validateLedgerTotal } from "@/lib/payment-ledger";
import { issueReceiptForPayment } from "@/lib/receipts";

export async function recordSubscriptionPayment(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    memberSubscriptionId: string;
    amount: number;
    actorId: string;
    source: string;
    paymentDate?: Date;
    paymentMethod?: string | null;
    notes?: string | null;
  },
) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) throw new Error("PAYMENT_AMOUNT_INVALID");
  const subscription = await tx.memberSubscription.findFirst({
    where: { tenantId: input.tenantId, id: input.memberSubscriptionId },
    select: { id: true, memberId: true, amount: true },
  });
  if (!subscription) throw new Error("SUBSCRIPTION_NOT_FOUND");

  const totalBefore = await getSubscriptionLedgerTotal(tx, subscription.id, input.tenantId);
  const totalAfter = totalBefore + input.amount;
  const totalCheck = validateLedgerTotal(totalAfter, subscription.amount);
  if (!totalCheck.ok) throw new Error(totalAfter < 0 ? "NEGATIVE_TOTAL" : "OVERPAY");

  const payment = await tx.payment.create({
    data: {
      tenantId: input.tenantId,
      memberSubscriptionId: subscription.id,
      amount: input.amount,
      entryType: "PAYMENT",
      createdById: input.actorId,
      paymentDate: input.paymentDate ?? new Date(),
      paymentMethod: input.paymentMethod?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });
  await tx.auditLog.create({
    data: {
      tenantId: input.tenantId,
      action: "PAYMENT_CREATED",
      entityType: "Payment",
      entityId: payment.id,
      userId: input.actorId,
      details: JSON.stringify({
        tenantId: input.tenantId,
        source: input.source,
        amount: input.amount,
        memberId: subscription.memberId,
        subscriptionId: subscription.id,
        totalBefore,
        totalAfter,
      }),
    },
  });

  const receipt = await issueReceiptForPayment(tx, payment.id, input.actorId, input.tenantId);
  await tx.auditLog.create({
    data: {
      tenantId: input.tenantId,
      action: "RECEIPT_ISSUED",
      entityType: "Receipt",
      entityId: receipt.id,
      userId: input.actorId,
      details: JSON.stringify({
        tenantId: input.tenantId,
        paymentId: payment.id,
        receiptNumber: receipt.receiptNumber,
        source: input.source,
      }),
    },
  });
  return { payment, receipt, totalBefore, totalAfter };
}
