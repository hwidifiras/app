import { FieldControl } from "@/components/ui/field-control";
import { FormField, FormSection } from "@/components/ui/form-layout";
import { formatMoney, MONEY_INPUT_SUFFIX } from "@/lib/money";

type PaymentAmountSectionProps = {
  hasSelectedSubscription: boolean;
  remaining: number;
  amount: string;
  amountNum: number;
  wouldExceed: boolean;
  displayBalanceAfter: number;
  onAmountChange: (amount: string) => void;
  onFillRemainingBalance: () => void;
  onFillHalfBalance: () => void;
  onClearAmount: () => void;
};

export function PaymentAmountSection({
  hasSelectedSubscription,
  remaining,
  amount,
  amountNum,
  wouldExceed,
  displayBalanceAfter,
  onAmountChange,
  onFillRemainingBalance,
  onFillHalfBalance,
  onClearAmount,
}: PaymentAmountSectionProps) {
  return (
    <FormSection
      id="payment-amount"
      title="2. Montant reçu"
      description="Saisissez ce que la réception vient réellement d'encaisser."
    >
      <FormField label="Montant encaissé (TND) *" htmlFor="amount">
        <div className="flex flex-col gap-2 sm:flex-row">
          <FieldControl suffix={MONEY_INPUT_SUFFIX} className="flex-1">
            <input
              id="amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              max={hasSelectedSubscription ? (remaining / 100).toFixed(2) : undefined}
              required
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              className={`field pr-10 text-lg font-semibold tabular-nums ${wouldExceed ? "border-[var(--danger)] ring-1 ring-[var(--danger)]" : ""}`}
              placeholder="0,00"
            />
          </FieldControl>
          <div className="grid grid-cols-3 gap-2 sm:w-auto sm:min-w-72">
            <button
              type="button"
              onClick={onFillRemainingBalance}
              disabled={!hasSelectedSubscription || remaining <= 0}
              className="btn btn-secondary whitespace-nowrap px-3"
            >
              Solder
            </button>
            <button
              type="button"
              onClick={onFillHalfBalance}
              disabled={!hasSelectedSubscription || remaining <= 0}
              className="btn btn-ghost whitespace-nowrap px-3"
            >
              Moitié
            </button>
            <button
              type="button"
              onClick={onClearAmount}
              disabled={!amount}
              className="btn btn-ghost whitespace-nowrap px-3"
            >
              Effacer
            </button>
          </div>
        </div>
        {hasSelectedSubscription ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-xs">
            <span className="text-[var(--muted-foreground)]">
              Maximum autorisé: <strong className="text-[var(--foreground)]">{formatMoney(remaining)}</strong>
            </span>
            {wouldExceed ? (
              <span className="font-semibold text-[var(--danger)]">Le montant dépasse le reste dû.</span>
            ) : amountNum > 0 ? (
              <span className="font-medium text-[var(--success)]">
                Solde après paiement: {formatMoney(displayBalanceAfter)}
              </span>
            ) : null}
          </div>
        ) : null}
      </FormField>
    </FormSection>
  );
}
