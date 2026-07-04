"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FieldControl } from "@/components/ui/field-control";
import { FormActions, FormField, FormGrid, FormSection, FormSectionNav } from "@/components/ui/form-layout";
import { formatMoney, MONEY_INPUT_SUFFIX } from "@/lib/money";

const METHODS = [
  { value: "CASH", label: "Espèces" },
  { value: "CARD", label: "Carte bancaire" },
  { value: "TRANSFER", label: "Virement" },
  { value: "CHECK", label: "Chèque" },
];

type PaymentEditFormProps = {
  payment: {
    id: string;
    amount: number;
    entryType: string;
    paymentDate: string;
    paymentMethod: string | null;
    notes: string | null;
    memberSubscription: {
      id: string;
      amount: number;
      member: { firstName: string; lastName: string };
      plan: { name: string } | null;
      payments: Array<{ id: string; amount: number; correctsPaymentId: string | null }>;
    };
  };
};

export function PaymentEditForm({ payment }: PaymentEditFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState((payment.amount / 100).toFixed(2).replace(".", ","));
  const [paymentDate, setPaymentDate] = useState(() => new Date(payment.paymentDate).toISOString().split("T")[0]);
  const [method, setMethod] = useState(payment.paymentMethod ?? "CASH");
  const [notes, setNotes] = useState(payment.notes ?? "");
  const [correctionReason, setCorrectionReason] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const subscription = payment.memberSubscription;
  const effectiveAmount =
    payment.amount +
    subscription.payments
      .filter((row) => row.correctsPaymentId === payment.id)
      .reduce((sum, row) => sum + row.amount, 0);
  const totalPaid = subscription.payments.reduce((sum, row) => sum + row.amount, 0);
  const otherPaid = totalPaid - effectiveAmount;
  const remaining = subscription.amount - otherPaid;
  const amountNum = Math.round(parseFloat(amount.replace(",", ".")) * 100) || 0;
  const wouldExceed = amountNum > remaining;
  const canMutate = payment.entryType === "PAYMENT";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canMutate || amountNum < 0) return;
    if (correctionReason.trim().length < 3) {
      setMessage("Motif obligatoire pour corriger un paiement.");
      return;
    }
    if (wouldExceed) {
      setMessage("Le montant dépasse le solde restant dû.");
      return;
    }

    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/payments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentId: payment.id,
        payload: {
          amount: amountNum,
          paymentDate: paymentDate ? new Date(paymentDate).toISOString() : undefined,
          paymentMethod: method,
          notes: notes.trim() || undefined,
          correctionReason: correctionReason.trim(),
        },
      }),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(json.error ?? "Erreur lors de la correction du paiement.");
      return;
    }

    router.push("/payments");
    router.refresh();
  }

  async function handleDelete() {
    if (!canMutate || deleteReason.trim().length < 3) {
      setMessage("Motif obligatoire pour annuler un paiement.");
      return;
    }

    setDeleting(true);
    setMessage(null);

    const res = await fetch("/api/payments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: payment.id, correctionReason: deleteReason.trim() }),
    });

    const json = await res.json();
    setDeleting(false);

    if (!res.ok) {
      setMessage(json.error ?? "Erreur lors de l'annulation du paiement.");
      return;
    }

    router.push("/payments");
    router.refresh();
  }

  const busy = loading || deleting;

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-4 lg:pb-0">
      {message && <FeedbackMessage message={message} />}

      <FormSectionNav
        items={[
          { href: "#payment-original", label: "Original" },
          { href: "#payment-correction", label: "Correction avec motif" },
          { href: "#payment-impact", label: "Impact" },
          { href: "#payment-reversal", label: "Annulation traçable" },
        ]}
      />

      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <FormSection
            id="payment-original"
            title="Paiement original"
            description="Paiement original conservé. Une correction avec motif ajoute une ligne traçable."
          >
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Membre</dt>
                <dd className="mt-1 font-medium">
                  {subscription.member.firstName} {subscription.member.lastName}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Formule</dt>
                <dd className="mt-1 font-medium">{subscription.plan?.name ?? "-"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Montant dû</dt>
                <dd className="mt-1 font-semibold">{formatMoney(subscription.amount)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Reste autorisé</dt>
                <dd className="mt-1 font-semibold">{formatMoney(remaining)}</dd>
              </div>
            </dl>
          </FormSection>

          {!canMutate && (
            <FeedbackMessage message="Cette ligne est déjà une correction ou une annulation traçable. Seul le paiement original peut être corrigé." />
          )}

          <FormSection id="payment-correction" title="Correction avec motif" description="Saisissez le nouveau montant et la raison visible dans le journal d'actions.">
            <FormGrid>
              <FormField label="Nouveau montant (TND) *" htmlFor="amount">
                <FieldControl suffix={MONEY_INPUT_SUFFIX}>
                  <input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`field pr-10 ${wouldExceed ? "border-[var(--danger)] ring-1 ring-[var(--danger)]" : ""}`}
                    placeholder="Ex: 49.90"
                    disabled={!canMutate}
                  />
                </FieldControl>
                {wouldExceed && (
                  <p className="mt-1 text-xs font-medium text-[var(--danger)]">Dépassement du solde restant dû.</p>
                )}
              </FormField>

              <FormField label="Date de correction" htmlFor="paymentDate">
                <input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="field"
                  disabled={!canMutate}
                />
              </FormField>

              <FormField label="Méthode" htmlFor="method">
                <select
                  id="method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="field"
                  disabled={!canMutate}
                >
                  {METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Notes" htmlFor="notes" hint="Facultatif: numéro de chèque, référence ou remarque.">
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="field min-h-[80px]"
                  placeholder="Ex: chèque n° 1234"
                  disabled={!canMutate}
                />
              </FormField>
            </FormGrid>

            <FormField label="Motif de correction *" htmlFor="correctionReason" className="mt-4">
              <textarea
                id="correctionReason"
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                className="field min-h-[72px]"
                placeholder="Ex: erreur de saisie du montant"
                required
                disabled={!canMutate}
              />
            </FormField>
          </FormSection>
        </div>

        <aside id="payment-impact" className="form-section-anchor lg:sticky lg:top-20 lg:col-span-4">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)]">
            <p className="text-sm font-semibold">Impact sur le solde</p>
            <p className="text-xs text-[var(--muted-foreground)]">Paiement original conservé</p>
            <dl className="mt-4 divide-y divide-[var(--border)] text-sm">
              <div className="flex items-start justify-between gap-3 py-2.5">
                <dt className="text-[var(--muted-foreground)]">Paiement original</dt>
                <dd className="text-right font-semibold">{formatMoney(payment.amount)}</dd>
              </div>
              <div className="flex items-start justify-between gap-3 py-2.5">
                <dt className="text-[var(--muted-foreground)]">Déjà corrigé</dt>
                <dd className="text-right font-semibold">{formatMoney(effectiveAmount - payment.amount)}</dd>
              </div>
              <div className="flex items-start justify-between gap-3 py-2.5">
                <dt className="text-[var(--muted-foreground)]">Autres paiements</dt>
                <dd className="text-right font-semibold">{formatMoney(otherPaid)}</dd>
              </div>
              <div className="flex items-start justify-between gap-3 py-2.5">
                <dt className="text-[var(--muted-foreground)]">Nouveau montant</dt>
                <dd className="text-right text-base font-bold text-[var(--primary)]">{formatMoney(amountNum)}</dd>
              </div>
              <div className="flex items-start justify-between gap-3 py-2.5">
                <dt className="text-[var(--muted-foreground)]">Maximum</dt>
                <dd className="text-right font-bold">{formatMoney(remaining)}</dd>
              </div>
            </dl>
            <p className="mt-3 rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
              Le système ajoute une correction avec motif. Le paiement initial n&apos;est jamais supprimé.
            </p>
          </div>
        </aside>
      </div>

      <FormActions sticky>
        <button
          type="button"
          onClick={() => router.push("/payments")}
          className="btn btn-ghost btn-block-mobile inline-flex items-center justify-center gap-1.5"
        >
          <ArrowLeft className="size-4" />
          Annuler
        </button>
        <button
          type="submit"
          disabled={busy || !canMutate || amountNum < 0 || wouldExceed || correctionReason.trim().length < 3}
          className="btn btn-primary btn-block-mobile inline-flex items-center justify-center gap-1.5"
        >
          {loading ? (
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Enregistrer la correction
        </button>
      </FormActions>

      <FormSection
        id="payment-reversal"
        title="Annulation traçable"
        description="L'annulation garde le paiement original et ajoute une ligne avec motif."
        className="border-[var(--danger)]/25"
      >
        <div className="mt-3 space-y-1.5">
          <label htmlFor="deleteReason" className="text-sm font-semibold text-[var(--foreground)]">
            Motif d&apos;annulation
          </label>
          <textarea
            id="deleteReason"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            className="field min-h-[72px]"
            placeholder="Ex: paiement saisi en double"
            disabled={!canMutate}
          />
        </div>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          disabled={busy || !canMutate || deleteReason.trim().length < 3}
          className="btn btn-ghost btn-block-mobile mt-3 min-h-11 inline-flex items-center justify-center gap-1.5 border border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger)]/10 sm:w-auto"
        >
          {deleting ? (
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-[var(--danger)] border-t-transparent" />
          ) : (
            <Trash2 className="size-4" />
          )}
          Annuler ce paiement
        </button>
      </FormSection>

      <ConfirmDialog
        open={deleteOpen}
        title="Annuler ce paiement ?"
        description={`Une annulation traçable de ${formatMoney(effectiveAmount)} sera ajoutée. Le paiement original restera visible.`}
        confirmLabel="Annuler le paiement"
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </form>
  );
}
