import { buildSubscriptionBillingView, formatMoney } from "@/lib/subscription-billing";
import { cn } from "@/lib/utils";
import type { PaymentGroup } from "./payment-table-model";

function progressPercent(paid: number, due: number) {
  if (due <= 0) return 100;
  return Math.min(100, Math.round((paid / due) * 100));
}

export function SubscriptionProgressBar({
  paid,
  due,
  complete,
  hasOffer,
}: {
  paid: number;
  due: number;
  complete: boolean;
  hasOffer: boolean;
}) {
  const pct = progressPercent(paid, due);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]" role="presentation">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-300",
          complete ? "bg-[var(--success)]" : hasOffer ? "bg-sky-500" : "bg-amber-500",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function StatusChip({
  statusLabel,
  statusTone,
}: {
  statusLabel: string;
  statusTone: "success" | "warning" | "muted";
}) {
  const classes =
    statusTone === "success"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
      : statusTone === "warning"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        : "bg-[var(--surface-soft)] text-[var(--muted-foreground)]";

  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold", classes)}>
      {statusLabel}
    </span>
  );
}

export function OfferRemark({ remark }: { remark: string | null }) {
  if (!remark) return null;
  return (
    <p className="mt-1 text-[0.65rem] leading-snug text-emerald-800 dark:text-emerald-200">{remark}</p>
  );
}

export function PaymentInstallmentStatus({ status }: { status: string }) {
  if (status === "Paiement complet") {
    return <span className="text-[0.65rem] font-medium text-emerald-700">{status}</span>;
  }
  if (status.startsWith("Correction") || status.startsWith("Annulation")) {
    return <span className="text-[0.65rem] font-medium text-violet-700">{status}</span>;
  }
  if (status.startsWith("Avance")) {
    return <span className="text-[0.65rem] font-medium text-sky-700">{status}</span>;
  }
  return <span className="text-[0.65rem] font-medium text-amber-700">{status}</span>;
}

export function AmountSummary({ group }: { group: PaymentGroup }) {
  const billing = buildSubscriptionBillingView({
    amount: group.totalDue,
    totalPaid: group.totalPaid,
    listPriceCents: group.listPriceCents,
    discountCents: group.discountCents,
    offerName: group.offerName,
  });

  return (
    <span className="shrink-0 text-right">
      <span
        className={cn(
          "block text-sm font-bold tabular-nums",
          billing.isComplete ? "text-emerald-700 dark:text-emerald-300" : "text-[var(--foreground)]",
        )}
      >
        {formatMoney(billing.totalPaid)}
      </span>
      <span className="block text-[0.65rem] tabular-nums text-[var(--muted-foreground)]">
        / {formatMoney(billing.amountDue)}
        {billing.hasOfferDiscount && billing.listPriceCents > billing.amountDue ? (
          <span className="ml-1 line-through opacity-70">{formatMoney(billing.listPriceCents)}</span>
        ) : null}
      </span>
      <OfferRemark remark={billing.offerRemark} />
    </span>
  );
}
