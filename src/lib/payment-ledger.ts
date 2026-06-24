import type { Payment, Prisma } from "@prisma/client";

export function sumLedgerRows(payments: Array<Pick<Payment, "amount">>): number {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

export async function getSubscriptionLedgerTotal(
  tx: Prisma.TransactionClient,
  memberSubscriptionId: string,
): Promise<number> {
  const aggregate = await tx.payment.aggregate({
    where: { memberSubscriptionId },
    _sum: { amount: true },
  });

  return aggregate._sum.amount ?? 0;
}

export async function getEffectivePaymentAmount(
  tx: Prisma.TransactionClient,
  paymentId: string,
): Promise<number> {
  const [payment, corrections] = await Promise.all([
    tx.payment.findUnique({
      where: { id: paymentId },
      select: { amount: true },
    }),
    tx.payment.aggregate({
      where: { correctsPaymentId: paymentId },
      _sum: { amount: true },
    }),
  ]);

  if (!payment) throw new Error("PAYMENT_NOT_FOUND");
  return payment.amount + (corrections._sum.amount ?? 0);
}

export function validateLedgerTotal(total: number, dueAmount: number) {
  if (total < 0) {
    return {
      ok: false as const,
      status: 409,
      error: "Le total des paiements ne peut pas devenir negatif",
    };
  }

  if (total > dueAmount) {
    return {
      ok: false as const,
      status: 409,
      error: "Depassement du montant du",
      details: { amountDue: dueAmount, attemptedTotal: total },
    };
  }

  return { ok: true as const };
}
