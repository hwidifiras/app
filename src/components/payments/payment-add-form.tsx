"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CreditCard, Wallet, Banknote, CheckCircle2 } from "lucide-react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions, FormField, FormGrid, FormSection } from "@/components/ui/form-layout";
import { ReceptionInfoCard, SubscriptionBillingSummary } from "@/components/ui/reception-info-card";
import { UndoButton } from "@/components/ui/undo-button";
import { useActionHistory } from "@/hooks/use-action-history";

const METHODS = [
  { value: "CASH", label: "Espèces", icon: <Banknote className="size-4" /> },
  { value: "CARD", label: "Carte bancaire", icon: <CreditCard className="size-4" /> },
  { value: "TRANSFER", label: "Virement", icon: <Wallet className="size-4" /> },
  { value: "CHECK", label: "Chèque", icon: <Banknote className="size-4" /> },
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

type SubscriptionRow = {
  id: string;
  memberName: string;
  planName: string;
  amount: number;
  totalPaid: number;
};

export function PaymentAddForm({
  subscriptions: initialSubscriptions,
  defaultSubscriptionId,
}: {
  subscriptions: SubscriptionRow[];
  defaultSubscriptionId?: string;
}) {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [subscriptionId, setSubscriptionId] = useState(defaultSubscriptionId ?? "");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { push, undoLast, loading: undoLoading, canUndo } = useActionHistory({ enableKeyboard: true });

  const selected = subscriptions.find((s) => s.id === subscriptionId);
  const remaining = selected ? selected.amount - selected.totalPaid : 0;
  const amountNum = Math.round(parseFloat(amount.replace(",", ".")) * 100) || 0;
  const wouldExceed = selected && amountNum > remaining;

  const successMessage = useMemo(
    () => (message?.startsWith("Paiement enregistré") ? message : null),
    [message],
  );

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

    const json = (await res.json()) as {
      data?: { id: string; amount: number; memberSubscriptionId: string };
      error?: string;
    };
    setLoading(false);

    if (!res.ok) {
      setMessage(json.error ?? "Erreur lors de l'enregistrement du paiement.");
      return;
    }

    const paymentId = json.data?.id;
    const paidAmount = json.data?.amount ?? amountNum;
    const paidSubscriptionId = json.data?.memberSubscriptionId ?? subscriptionId;

    setSubscriptions((current) =>
      current.map((row) =>
        row.id === paidSubscriptionId
          ? { ...row, totalPaid: row.totalPaid + paidAmount }
          : row,
      ),
    );

    if (paymentId) {
      push({
        scope: "payment",
        label: "Encaissement",
        undo: async () => {
          const deleteRes = await fetch("/api/payments", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId }),
          });
          const deleteJson = (await deleteRes.json()) as { error?: string };
          if (!deleteRes.ok) {
            setMessage(deleteJson.error ?? "Impossible d'annuler le paiement.");
            return false;
          }

          setSubscriptions((current) =>
            current.map((row) =>
              row.id === paidSubscriptionId
                ? { ...row, totalPaid: Math.max(0, row.totalPaid - paidAmount) }
                : row,
            ),
          );
          setMessage("Dernier paiement annulé.");
          return true;
        },
      });
    }

    setAmount("");
    setNotes("");
    setMessage("Paiement enregistré avec succès.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && (
        <FeedbackMessage
          message={message}
          variant={successMessage ? "success" : message.startsWith("Dernier paiement annulé") ? "success" : undefined}
        />
      )}

      {successMessage && canUndo ? (
        <div className="flex flex-wrap items-center gap-2">
          <UndoButton
            onClick={() => undoLast()}
            disabled={undoLoading || loading}
            label="Annuler ce paiement"
            title="Annuler le dernier encaissement (Ctrl+Z)"
          />
          <Link href="/payments" className="text-sm font-medium text-[var(--primary)] hover:underline">
            Voir l&apos;historique
          </Link>
        </div>
      ) : null}

      <ReceptionInfoCard title="Rappel" variant="info">
        Encaisser règle le solde dû. Cela ne crée pas de séances supplémentaires.
      </ReceptionInfoCard>

      <FormSection title="Abonnement" description="Sélectionnez l'abonnement à régler.">
        <FormField label="Abonnement *" htmlFor="subscription">
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
                {s.memberName} — {s.planName} (dû: {formatCurrency(s.amount)}, payé:{" "}
                {formatCurrency(s.totalPaid)})
              </option>
            ))}
          </select>
          {subscriptions.length === 0 && (
            <p className="mt-1 text-xs text-[var(--warning)]">
              Aucun abonnement actif trouvé. Créez d&apos;abord un abonnement.
            </p>
          )}
          {selected && (
            <div className="mt-3">
              <SubscriptionBillingSummary
                amountDueCents={selected.amount}
                totalPaidCents={selected.totalPaid}
              />
            </div>
          )}
        </FormField>
      </FormSection>

      <FormSection title="Montant">
        <FormField label="Montant (€) *" htmlFor="amount">
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
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted-foreground)]">
              €
            </span>
          </div>
          {selected && (
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-[var(--muted-foreground)]">
                Restant dû: <strong className="text-[var(--foreground)]">{formatCurrency(remaining)}</strong>
              </span>
              {wouldExceed && <span className="font-medium text-[var(--danger)]">Dépassement !</span>}
            </div>
          )}
        </FormField>
      </FormSection>

      <FormGrid>
        <FormField label="Date de paiement" htmlFor="paymentDate">
          <input
            id="paymentDate"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="field"
          />
        </FormField>
        <FormField label="Méthode" htmlFor="method">
          <select id="method" value={method} onChange={(e) => setMethod(e.target.value)} className="field">
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </FormField>
      </FormGrid>

      <FormSection>
        <FormField label="Notes" htmlFor="notes">
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="field min-h-[80px]"
            placeholder="Numéro de chèque, remarque..."
          />
        </FormField>
      </FormSection>

      <FormActions sticky>
        <button type="button" onClick={() => router.push("/payments")} className="btn btn-ghost btn-block-mobile">
          <ArrowLeft className="size-4" />
          Annuler
        </button>
        <button
          type="submit"
          disabled={loading || !subscriptionId || amountNum <= 0 || wouldExceed}
          className="btn btn-primary btn-block-mobile"
        >
          {loading ? (
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Enregistrer le paiement
        </button>
      </FormActions>
    </form>
  );
}
