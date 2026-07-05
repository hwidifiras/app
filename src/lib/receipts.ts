import { createHash, randomBytes } from "node:crypto";
import type { Prisma, Receipt } from "@prisma/client";

import { getSubscriptionLedgerTotal } from "@/lib/payment-ledger";

const DEFAULT_RECEIPT_PREFIX = "WD";

type ReceiptSettingsRow = {
  id: string;
  clubName: string;
  clubLogoUrl: string;
  clubAddress: string;
  clubPhone: string;
  receiptLegalName: string;
  receiptTaxId: string;
  receiptPrefix: string;
  nextReceiptSequence: number;
  receiptFooter: string;
};

export type ReceiptSnapshot = {
  receipt: {
    id: string;
    receiptNumber: string;
    verificationCode: string;
    status: "ISSUED" | "VOIDED";
    issuedAt: string;
    contentHash: string;
  };
  club: {
    name: string;
    logoUrl: string;
    address: string;
    phone: string;
    legalName?: string;
    taxId?: string;
    footer: string;
  };
  member: {
    id: string;
    name: string;
    phone: string;
  };
  subscription: {
    id: string;
    planName: string;
    sportName: string;
    amountCents: number;
    startDate: string;
    endDate: string | null;
  };
  payment: {
    id: string;
    amountCents: number;
    paymentDate: string;
    paymentMethod: string | null;
    notes: string | null;
  };
  totals: {
    paidAfterCents: number;
    remainingAfterCents: number;
  };
};

export function normalizeReceiptPrefix(value: string | null | undefined): string {
  const normalized = (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 10);
  return normalized.length >= 2 ? normalized : DEFAULT_RECEIPT_PREFIX;
}

export function formatReceiptNumber(prefix: string, issuedAt: Date, sequence: number): string {
  const year = issuedAt.getUTCFullYear();
  return `${normalizeReceiptPrefix(prefix)}-${year}-${String(Math.max(1, sequence)).padStart(6, "0")}`;
}

export function generateReceiptVerificationCode(): string {
  return randomBytes(5).toString("hex").toUpperCase();
}

export function hashReceiptSnapshot(snapshot: Omit<ReceiptSnapshot, "receipt">): string {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

export function parseReceiptSnapshot(receipt: Pick<Receipt, "snapshotJson">): ReceiptSnapshot | null {
  try {
    const parsed = JSON.parse(receipt.snapshotJson) as ReceiptSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function nextReceiptSettings(
  tx: Prisma.TransactionClient,
): Promise<{ settings: ReceiptSettingsRow; sequence: number }> {
  const existing = await tx.clubSettings.findFirst({
    select: {
      id: true,
      clubName: true,
      clubLogoUrl: true,
      clubAddress: true,
      clubPhone: true,
      receiptLegalName: true,
      receiptTaxId: true,
      receiptPrefix: true,
      nextReceiptSequence: true,
      receiptFooter: true,
    },
  });

  if (!existing) {
    const created = await tx.clubSettings.create({
      data: { nextReceiptSequence: 2 },
      select: {
        id: true,
        clubName: true,
        clubLogoUrl: true,
        clubAddress: true,
        clubPhone: true,
        receiptLegalName: true,
        receiptTaxId: true,
        receiptPrefix: true,
        nextReceiptSequence: true,
        receiptFooter: true,
      },
    });
    return { settings: created, sequence: 1 };
  }

  const updated = await tx.clubSettings.update({
    where: { id: existing.id },
    data: { nextReceiptSequence: { increment: 1 } },
    select: {
      id: true,
      clubName: true,
      clubLogoUrl: true,
      clubAddress: true,
      clubPhone: true,
      receiptLegalName: true,
      receiptTaxId: true,
      receiptPrefix: true,
      nextReceiptSequence: true,
      receiptFooter: true,
    },
  });

  return { settings: updated, sequence: Math.max(1, updated.nextReceiptSequence - 1) };
}

export async function issueReceiptForPayment(
  tx: Prisma.TransactionClient,
  paymentId: string,
  issuedById: string | null,
): Promise<Receipt> {
  const existingReceipt = await tx.receipt.findUnique({
    where: { paymentId },
  });
  if (existingReceipt) return existingReceipt;

  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    include: {
      memberSubscription: {
        include: {
          member: { select: { id: true, firstName: true, lastName: true, phone: true } },
          plan: { select: { name: true } },
          sport: { select: { name: true } },
        },
      },
    },
  });

  if (!payment) throw new Error("PAYMENT_NOT_FOUND");
  if (payment.entryType !== "PAYMENT") throw new Error("RECEIPT_PAYMENT_ONLY");

  const issuedAt = new Date();
  const { settings, sequence } = await nextReceiptSettings(tx);
  const receiptNumber = formatReceiptNumber(settings.receiptPrefix, issuedAt, sequence);
  const verificationCode = generateReceiptVerificationCode();
  const totalPaidAfter = await getSubscriptionLedgerTotal(tx, payment.memberSubscriptionId);
  const remainingAfter = Math.max(0, payment.memberSubscription.amount - totalPaidAfter);

  const snapshotWithoutReceipt = {
    club: {
      name: settings.clubName || "Club",
      logoUrl: settings.clubLogoUrl || "",
      address: settings.clubAddress || "",
      phone: settings.clubPhone || "",
      legalName: settings.receiptLegalName || "",
      taxId: settings.receiptTaxId || "",
      footer: settings.receiptFooter || "",
    },
    member: {
      id: payment.memberSubscription.member.id,
      name: `${payment.memberSubscription.member.firstName} ${payment.memberSubscription.member.lastName}`.trim(),
      phone: payment.memberSubscription.member.phone || "",
    },
    subscription: {
      id: payment.memberSubscription.id,
      planName: payment.memberSubscription.plan.name,
      sportName: payment.memberSubscription.sport.name,
      amountCents: payment.memberSubscription.amount,
      startDate: payment.memberSubscription.startDate.toISOString(),
      endDate: payment.memberSubscription.endDate?.toISOString() ?? null,
    },
    payment: {
      id: payment.id,
      amountCents: payment.amount,
      paymentDate: payment.paymentDate.toISOString(),
      paymentMethod: payment.paymentMethod,
      notes: payment.notes,
    },
    totals: {
      paidAfterCents: totalPaidAfter,
      remainingAfterCents: remainingAfter,
    },
  } satisfies Omit<ReceiptSnapshot, "receipt">;

  const contentHash = hashReceiptSnapshot(snapshotWithoutReceipt);
  const snapshot: ReceiptSnapshot = {
    receipt: {
      id: "",
      receiptNumber,
      verificationCode,
      status: "ISSUED",
      issuedAt: issuedAt.toISOString(),
      contentHash,
    },
    ...snapshotWithoutReceipt,
  };

  const created = await tx.receipt.create({
    data: {
      paymentId: payment.id,
      receiptNumber,
      verificationCode,
      status: "ISSUED",
      issuedAt,
      issuedById,
      snapshotJson: JSON.stringify(snapshot),
      contentHash,
    },
  });

  const finalSnapshot: ReceiptSnapshot = {
    ...snapshot,
    receipt: {
      ...snapshot.receipt,
      id: created.id,
    },
  };

  return tx.receipt.update({
    where: { id: created.id },
    data: { snapshotJson: JSON.stringify(finalSnapshot) },
  });
}

export async function voidReceiptForPayment(
  tx: Prisma.TransactionClient,
  paymentId: string,
  reason: string,
): Promise<Receipt | null> {
  const receipt = await tx.receipt.findUnique({
    where: { paymentId },
  });

  if (!receipt || receipt.status === "VOIDED") return null;

  return tx.receipt.update({
    where: { id: receipt.id },
    data: {
      status: "VOIDED",
      voidedAt: new Date(),
      voidReason: reason.trim(),
    },
  });
}
