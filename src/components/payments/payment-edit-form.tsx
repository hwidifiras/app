"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { FeedbackMessage } from "@/components/ui/feedback-message";

const METHODS = [
  { value: "CASH", label: "Espèces" },
  { value: "CARD", label: "Carte bancaire" },
  { value: "TRANSFER", label: "Virement" },
  { value: "CHECK", label: "Chèque" },
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

type PaymentEditFormProps = {
  payment: {
    id: string;
    amount: number;
    paymentDate: string;
    paymentMethod: string | null;
    notes: string | null;
    memberSubscription: {
      id: string;
      amount: number;
      member: { firstName: string; lastName: string };
      plan: { name: string } | null;
      payments: Array<{ id: string; amount: number }>;
    };
  };
};

export function PaymentEditForm({ payment }: PaymentEditFormProps) {
  const router = useRouter();
  const [amount, setAmount] = useState((payment.amount / 100).toFixed(2).replace(".", ","));
  const [paymentDate, setPaymentDate] = useState(() =>
    new Date(payment.paymentDate).toISOString().split("T")[0]
  );
  const [method, setMethod] = useState(payment.paymentMethod ?? "CASH");
  const [notes, setNotes] = useState(payment.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const subscription = payment.memberSubscription;
  const otherPaid = subscription.payments
    .filter((p) => p.id !== payment.id)
    .reduce((sum, p) => sum + p.amount, 0);
  const remaining = subscription.amount - otherPaid;
  const amountNum = Math.round(parseFloat(amount.replace(",", ".")) * 100) || 0;
  const wouldExceed = amountNum > remaining;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amountNum <= 0) return;
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
        },
      }),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(json.error ?? "Erreur lors de la modification du paiement.");
      return;
    }

    setMessage("Paiement modifié avec succès.");
    setTimeout(() => router.push("/payments"), 800);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {message && <FeedbackMessage message={message} />}

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-4 py-3 text-sm">
        <p className="text-[var(--muted-foreground)]">
          Abonnement :{" "}
          <span className="font-medium text-[var(--foreground)]">
            {subscription.member.firstName} {subscription.member.lastName}
          </span>{" "}
          — {subscription.plan?.name ?? "—"}
        </p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Montant dû: {formatCurrency(subscription.amount)} — Autres paiements: {formatCurrency(otherPaid)} — Reste: {formatCurrency(remaining)}
        </p>
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <label htmlFor="amount" className="text-sm font-semibold text-[var(--foreground)]">
          Montant (€) <span className="text-[var(--danger)]">*</span>
        </label>
        <div className="relative">
          <input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`field pr-10 ${wouldExceed ? "border-[var(--danger)] ring-1 ring-[var(--danger)]" : ""}`}
            placeholder="Ex: 49.90"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted-foreground)]">€</span>
        </div>
        {wouldExceed && (
          <p className="text-xs text-[var(--danger)] font-medium">Dépassement du solde restant dû !</p>
        )}
      </div>

      {/* Date + Method row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="paymentDate" className="text-sm font-semibold text-[var(--foreground)]">
            Date de paiement
          </label>
          <input
            id="paymentDate"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="field"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="method" className="text-sm font-semibold text-[var(--foreground)]">
            Méthode
          </label>
          <select
            id="method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="field"
          >
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label htmlFor="notes" className="text-sm font-semibold text-[var(--foreground)]">
          Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="field min-h-[80px]"
          placeholder="Numéro de chèque, remarque..."
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => router.push("/payments")}
          className="btn btn-ghost inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="size-4" />
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading || amountNum <= 0 || wouldExceed}
          className="btn btn-primary inline-flex items-center gap-1.5"
        >
          {loading ? (
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Enregistrer la modification
        </button>
      </div>
    </form>
  );
}
