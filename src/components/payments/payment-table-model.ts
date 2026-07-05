import type { ReceiptDeliveryStatus } from "@/lib/receipt-delivery-status";

export type PaymentGroup = {
  subscriptionId: string;
  memberName: string;
  planName: string;
  totalDue: number;
  totalPaid: number;
  listPriceCents: number | null;
  discountCents: number;
  offerName: string | null;
  isComplete: boolean;
  payments: Array<{
    id: string;
    amount: number;
    paymentDate: string;
    createdAt: string;
    paymentMethod: string | null;
    memberEmail: string | null;
    entryType: "PAYMENT" | "CORRECTION" | "REVERSAL";
    correctionReason: string | null;
    receipt: {
      id: string;
      receiptNumber: string;
      verificationCode: string;
      status: "ISSUED" | "VOIDED";
      deliveryStatus?: ReceiptDeliveryStatus | null;
    } | null;
    sequence: number;
    status: string;
  }>;
};

export function ledgerTypeLabel(entryType: PaymentGroup["payments"][number]["entryType"]) {
  if (entryType === "CORRECTION") return "Correction avec motif";
  if (entryType === "REVERSAL") return "Annulation traçable";
  return "Paiement";
}
