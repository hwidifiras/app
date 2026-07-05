import { ReceiptText } from "lucide-react";

import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

type PaymentSummarySubscription = {
  memberName: string;
  planName: string;
};

type PaymentSummaryPanelProps = {
  selected: PaymentSummarySubscription | undefined;
  remaining: number;
  amountNum: number;
  wouldExceed: boolean;
  displayBalanceAfter: number;
  canSubmit: boolean;
};

export function PaymentSummaryPanel({
  selected,
  remaining,
  amountNum,
  wouldExceed,
  displayBalanceAfter,
  canSubmit,
}: PaymentSummaryPanelProps) {
  return (
    <aside id="payment-summary" className="form-section-anchor lg:sticky lg:top-20 lg:col-span-4">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)]">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
            <ReceiptText className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold">Reçu à confirmer</p>
            <p className="text-xs text-[var(--muted-foreground)]">Vérification avant encaissement</p>
          </div>
        </div>

        <dl className="mt-4 divide-y divide-[var(--border)] text-sm">
          <div className="flex items-start justify-between gap-3 py-2.5">
            <dt className="text-[var(--muted-foreground)]">Membre</dt>
            <dd className="text-right font-medium">{selected?.memberName ?? "Non sélectionné"}</dd>
          </div>
          <div className="flex items-start justify-between gap-3 py-2.5">
            <dt className="text-[var(--muted-foreground)]">Abonnement</dt>
            <dd className="text-right font-medium">{selected?.planName ?? "Non sélectionné"}</dd>
          </div>
          <div className="flex items-start justify-between gap-3 py-2.5">
            <dt className="text-[var(--muted-foreground)]">Reste actuel</dt>
            <dd className="text-right font-semibold">{selected ? formatMoney(remaining) : "—"}</dd>
          </div>
          <div className="flex items-start justify-between gap-3 py-2.5">
            <dt className="text-[var(--muted-foreground)]">Montant reçu</dt>
            <dd className="text-right text-base font-bold text-[var(--primary)]">
              {amountNum > 0 ? formatMoney(amountNum) : "—"}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3 py-2.5">
            <dt className="text-[var(--muted-foreground)]">Solde après</dt>
            <dd
              className={cn(
                "text-right font-bold",
                wouldExceed
                  ? "text-[var(--danger)]"
                  : displayBalanceAfter > 0
                    ? "text-[var(--danger)]"
                    : "text-[var(--success)]",
              )}
            >
              {wouldExceed
                ? "Montant invalide"
                : selected && amountNum > 0
                  ? formatMoney(displayBalanceAfter)
                  : "—"}
            </dd>
          </div>
        </dl>

        <p className="mt-3 rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
          Cet encaissement réduit le solde de l&apos;abonnement. Il n&apos;ajoute pas de séances.
        </p>

        {!canSubmit ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            Sélectionnez une dette et saisissez un montant valide pour activer la confirmation.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
