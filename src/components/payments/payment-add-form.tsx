"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Wallet, Banknote, CheckCircle2 } from "lucide-react";

import { FeedbackMessage } from "@/components/ui/feedback-message";

const METHODS = [
  { value: "CASH", label: "Espèces", icon: <Banknote className="size-4" /> },
  { value: "CARD", label: "Carte bancaire", icon: <CreditCard className="size-4" /> },
  { value: "TRANSFER", label: "Virement", icon: <Wallet className="size-4" /> },
  { value: "CHECK", label: "Chèque", icon: <Banknote className="size-4" /> },
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function PaymentAddForm({
  subscriptions,
}: {
  subscriptions: Array<{
    id: string;
    memberName: string;
    planName: string;
    amount: number; // montant dû en centimes
    totalPaid: number; // déjà payé en centimes
  }>;
}) {
  const router = useRouter();
  const [subscriptionId, setSubscriptionId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = subscriptions.find((s) => s.id === subscriptionId);
  const remaining = selected ? selected.amount - selected.totalPaid : 0;
  const amountNum = Math.round(parseFloat(amount.replace(",", ".")) * 100) || 0;
  const wouldExceed = selected && amountNum > remaining;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subscriptionId || amountNum <= 0) return;
    if (wouldExceed) {
      setMessage("Le montant dépasse le solde restant dû.");
      return;
    }

    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberSubscriptionId: subscriptionId,
        amount: amountNum,
        paymentDate: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        paymentMethod: method,
        notes: notes.trim() || undefined,
      }),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(json.error ?? "Erreur lors de l'enregistrement du paiement.");
      return;
    }

    setMessage("Paiement enregistré avec succès.");
    setTimeout(() => router.push("/payments"), 800);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {message && <FeedbackMessage message={message} />}

      {/* Subscription selector */}
      <div className="space-y-1.5">
        <label htmlFor="subscription" className="text-sm font-semibold text-[var(--foreground)]">
          Abonnement <span className="text-[var(--danger)]">*</span>
        </label>
        <select
          id="subscription"
          value={subscriptionId}
          onChange={(e) => setSubscriptionId(e.target.value)}
          required
          className="field"
        >
          <option value="">Sélectionner un abonnement...</option>
          {subscriptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.memberName} — {s.planName} (dû: {formatCurrency(s.amount)}, payé: {formatCurrency(s.totalPaid)})
            </option>
          ))}
        </select>
        {subscriptions.length === 0 && (
          <p className="text-xs text-[var(--warning)]">Aucun abonnement actif trouvé. Créez d'abord un abonnement.</p>
        )}
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
        {selected && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--muted-foreground)]">
              Restant dû: <strong className="text-[var(--foreground)]">{formatCurrency(remaining)}</strong>
            </span>
            {wouldExceed && (
              <span className="text-[var(--danger)] font-medium">Dépassement !</span>
            )}
          </div>
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
          disabled={loading || !subscriptionId || amountNum <= 0 || wouldExceed}
          className="btn btn-primary inline-flex items-center gap-1.5"
        >
          {loading ? (
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Enregistrer le paiement
        </button>
      </div>
    </form>
  );
}
