import type { Ref } from "react";

import { FieldControl } from "@/components/ui/field-control";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";
import { ReceptionInfoCard } from "@/components/ui/reception-info-card";
import { formatMoney, MONEY_INPUT_SUFFIX } from "@/lib/money";
import type { LineState, QuoteData } from "@/components/enrollment/enrollment-types";

type EnrollmentQuotePanelProps = {
  quote: QuoteData;
  lines: LineState[];
  quotePaidCents: number;
  loading: boolean;
  completed: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
  onBack: () => void;
  onPaymentChange: (lineIndex: number, value: string) => void;
};

export function EnrollmentQuotePanel({
  quote,
  lines,
  quotePaidCents,
  loading,
  completed,
  headingRef,
  onBack,
  onPaymentChange,
}: EnrollmentQuotePanelProps) {
  return (
    <section className="panel space-y-4 p-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary)]">3. Devis + paiement</p>
        <h2 ref={headingRef} tabIndex={-1} className="mt-1 text-lg font-semibold outline-none">
          Confirmer l&apos;inscription
        </h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Contrôlez le prix, l&apos;offre appliquée et l&apos;acompte encaissé avant validation.
        </p>
      </div>
      {quote.offerName ? <p className="text-sm font-medium text-green-700">Offre appliquée: {quote.offerName}</p> : null}
      <ul className="space-y-3 text-sm">
        {quote.lines.map((line) => {
          const paymentValue = lines[line.lineIndex]?.paymentCents ?? "";
          const paymentNumber = parseFloat(paymentValue.replace(",", "."));
          const paymentCents = Number.isFinite(paymentNumber) ? Math.round(paymentNumber * 100) : 0;
          const balanceAfterPayment = Math.max(0, line.finalAmountCents - Math.max(0, paymentCents));

          return (
            <li key={line.lineIndex} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">{line.memberName}</p>
                  <p className="text-[var(--muted-foreground)]">
                    {line.groupName} — {line.planName} ({line.sportName})
                  </p>
                </div>
                <span className="rounded-full bg-[var(--primary)]/10 px-2.5 py-1 text-xs font-bold text-[var(--primary)]">
                  {formatMoney(line.finalAmountCents)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 sm:grid-cols-4">
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Catalogue</p>
                  <p className="mt-1 font-bold">{formatMoney(line.listPriceCents)}</p>
                </div>
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Remise</p>
                  <p className={`mt-1 font-bold ${line.discountCents > 0 ? "text-[var(--success)]" : "text-[var(--muted-foreground)]"}`}>
                    {line.discountCents > 0 ? `-${formatMoney(line.discountCents)}` : "Aucune"}
                  </p>
                </div>
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">À payer</p>
                  <p className="mt-1 font-bold text-[var(--foreground)]">{formatMoney(line.finalAmountCents)}</p>
                </div>
                <div>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Reste après acompte</p>
                  <p className={`mt-1 font-bold ${balanceAfterPayment > 0 ? "text-[var(--warning)]" : "text-[var(--success)]"}`}>
                    {formatMoney(balanceAfterPayment)}
                  </p>
                </div>
              </div>
              {line.discountCents > 0 && quote.offerName ? (
                <ReceptionInfoCard variant="success" className="mt-2">
                  <p className="font-semibold">Offre « {quote.offerName} »</p>
                  <p>
                    Nouvel abonnement à {formatMoney(line.finalAmountCents)} — le paiement ci-dessous est prérempli.
                  </p>
                </ReceptionInfoCard>
              ) : null}
              {line.reusesExistingSubscription && line.discountCents === 0 ? (
                <ReceptionInfoCard variant="warning" className="mt-2">
                  <p className="font-semibold">Même abonnement réutilisé</p>
                  <p>Pas de nouvelles séances — ajout d&apos;un cours ou paiement du solde uniquement.</p>
                </ReceptionInfoCard>
              ) : null}
              {line.warnings.length > 0 ? <p className="mt-1 text-xs text-red-600">{line.warnings.join(" • ")}</p> : null}
              {line.blocked ? <p className="mt-1 text-xs font-medium text-red-600">Cette ligne est bloquée.</p> : null}
              <label className="mt-2 block text-sm">
                <span className="font-medium">
                  {line.reusesExistingSubscription ? "Paiement complémentaire (TND)" : "Paiement initial (TND)"}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                  Max {formatMoney(line.finalAmountCents)} pour cette période
                </span>
                <FieldControl suffix={MONEY_INPUT_SUFFIX} className="mt-1">
                  <input
                    type="text"
                    inputMode="decimal"
                    className="field pr-10"
                    value={paymentValue}
                    onChange={(event) => onPaymentChange(line.lineIndex, event.target.value)}
                  />
                </FieldControl>
              </label>
            </li>
          );
        })}
      </ul>
      {quote.warnings.length > 0 ? <FeedbackMessage variant="error" message={quote.warnings.join(" • ")} /> : null}
      <FormActions sticky>
        <button type="button" className="btn btn-ghost btn-block-mobile" onClick={onBack}>
          Retour
        </button>
        <button type="submit" className="btn btn-primary btn-block-mobile" disabled={loading || completed || quote.blocked}>
          {loading ? "Inscription…" : `Confirmer ${formatMoney(quotePaidCents)}`}
        </button>
      </FormActions>
    </section>
  );
}
