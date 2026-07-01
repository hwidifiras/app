export type SubscriptionBillingInput = {
  amount: number;
  totalPaid: number;
  listPriceCents?: number | null;
  discountCents?: number | null;
  offerName?: string | null;
};

export type SubscriptionBillingView = {
  amountDue: number;
  listPriceCents: number;
  totalPaid: number;
  remaining: number;
  isComplete: boolean;
  hasOfferDiscount: boolean;
  offerName: string | null;
  /** Short label for chips (Payé, Reste X, etc.) */
  statusLabel: string;
  /** success = green, warning = amber, muted = neutral */
  statusTone: "success" | "warning" | "muted";
  /** Human-readable offer context for tables and cards */
  offerRemark: string | null;
};

export function formatMoney(cents: number, currency = "TND") {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(cents / 100);
}

export function formatPaymentPrefill(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function buildSubscriptionBillingView(input: SubscriptionBillingInput): SubscriptionBillingView {
  const amountDue = input.amount;
  const listPriceCents = input.listPriceCents ?? input.amount;
  const discountCents = input.discountCents ?? Math.max(0, listPriceCents - amountDue);
  const hasOfferDiscount = discountCents > 0 || Boolean(input.offerName && listPriceCents > amountDue);
  const totalPaid = input.totalPaid;
  const remaining = Math.max(0, amountDue - totalPaid);
  const isComplete = totalPaid >= amountDue && amountDue > 0;

  let statusLabel: string;
  let statusTone: SubscriptionBillingView["statusTone"];

  if (isComplete) {
    statusLabel = hasOfferDiscount ? "Payé (offre)" : "Payé";
    statusTone = "success";
  } else if (totalPaid > 0) {
    statusLabel = `Reste ${formatMoney(remaining)}`;
    statusTone = "warning";
  } else {
    statusLabel = `Dû ${formatMoney(amountDue)}`;
    statusTone = "warning";
  }

  let offerRemark: string | null = null;
  if (hasOfferDiscount && input.offerName) {
    offerRemark = `Offre « ${input.offerName} » : ${formatMoney(amountDue)} au lieu de ${formatMoney(listPriceCents)}`;
  } else if (hasOfferDiscount) {
    offerRemark = `Tarif réduit : ${formatMoney(amountDue)} au lieu de ${formatMoney(listPriceCents)}`;
  }

  return {
    amountDue,
    listPriceCents,
    totalPaid,
    remaining,
    isComplete,
    hasOfferDiscount,
    offerName: input.offerName ?? null,
    statusLabel,
    statusTone,
    offerRemark,
  };
}
