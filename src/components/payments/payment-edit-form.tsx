"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FieldControl } from "@/components/ui/field-control";
import { FormActions } from "@/components/ui/form-layout";

const METHODS = [
  { value: "CASH", label: "Especes" },
  { value: "CARD", label: "Carte bancaire" },
  { value: "TRANSFER", label: "Virement" },
  { value: "CHECK", label: "Cheque" },
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

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
      setMessage("Le montant depasse le solde restant du.");
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
    <form onSubmit={handleSubmit} className="space-y-5">
      {message && <FeedbackMessage message={message} />}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm">
        <p className="text-[var(--muted-foreground)]">
          Abonnement:{" "}
          <span className="font-medium text-[var(--foreground)]">
            {subscription.member.firstName} {subscription.member.lastName}
          </span>{" "}
          - {subscription.plan?.name ?? "-"}
        </p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Montant du: {formatCurrency(subscription.amount)} - Autres paiements: {formatCurrency(otherPaid)} -
          Reste: {formatCurrency(remaining)}
        </p>
      </div>

      {!canMutate && (
        <FeedbackMessage message="Cette ligne est deja une correction ou une annulation. Seul le paiement original peut etre corrige." />
      )}

      <div className="space-y-1.5">
        <label htmlFor="amount" className="text-sm font-semibold text-[var(--foreground)]">
          Montant corrige (EUR) <span className="text-[var(--danger)]">*</span>
        </label>
        <FieldControl suffix="EUR">
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
          <p className="text-xs font-medium text-[var(--danger)]">Depassement du solde restant du.</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="paymentDate" className="text-sm font-semibold text-[var(--foreground)]">
            Date de correction
          </label>
          <input
            id="paymentDate"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="field"
            disabled={!canMutate}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="method" className="text-sm font-semibold text-[var(--foreground)]">
            Methode
          </label>
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
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="notes" className="text-sm font-semibold text-[var(--foreground)]">
          Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="field min-h-[80px]"
          placeholder="Numero de cheque, remarque..."
          disabled={!canMutate}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="correctionReason" className="text-sm font-semibold text-[var(--foreground)]">
          Motif de correction <span className="text-[var(--danger)]">*</span>
        </label>
        <textarea
          id="correctionReason"
          value={correctionReason}
          onChange={(e) => setCorrectionReason(e.target.value)}
          className="field min-h-[72px]"
          placeholder="Ex: erreur de saisie du montant"
          required
          disabled={!canMutate}
        />
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

      <section className="rounded-lg border border-[var(--danger)]/25 bg-[var(--surface-soft)] p-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Zone sensible</h2>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          L&apos;annulation garde le paiement original et ajoute une ligne de reversal au grand livre.
        </p>
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
      </section>

      <ConfirmDialog
        open={deleteOpen}
        title="Annuler ce paiement ?"
        description={`Une ligne de reversal de ${formatCurrency(effectiveAmount)} sera ajoutee au grand livre. Le paiement original restera visible.`}
        confirmLabel="Annuler le paiement"
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
      />
    </form>
  );
}
