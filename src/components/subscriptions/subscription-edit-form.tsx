"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";
import { ReceptionInfoCard } from "@/components/ui/reception-info-card";

type PlanOption = { id: string; name: string; price: number; totalSessions: number; validityDays: number };
type StatusValue = "DRAFT" | "ACTIVE" | "EXPIRED" | "CANCELLED";

type SubscriptionEditFormProps = {
  subscription: {
    id: string;
    memberName: string;
    planId: string;
    startDate: string;
    endDate: string | null;
    amount: number;
    remainingSessions: number;
    status: StatusValue;
  };
  plansOptions: PlanOption[];
};

function dateInputValue(value: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().split("T")[0];
}

export function SubscriptionEditForm({ subscription, plansOptions }: SubscriptionEditFormProps) {
  const router = useRouter();
  const [planId, setPlanId] = useState(subscription.planId);
  const [startDate, setStartDate] = useState(dateInputValue(subscription.startDate));
  const [endDate, setEndDate] = useState(dateInputValue(subscription.endDate));
  const [amount, setAmount] = useState((subscription.amount / 100).toString());
  const [remainingSessions, setRemainingSessions] = useState(subscription.remainingSessions.toString());
  const [status, setStatus] = useState<StatusValue>(subscription.status);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const amountNum = Math.round(parseFloat(amount || "0") * 100);
  const sessionsNum = Math.max(0, Math.round(Number(remainingSessions || 0)));
  const needsAdjustmentReason =
    amountNum !== subscription.amount || sessionsNum !== subscription.remainingSessions;

  function handlePlanChange(nextPlanId: string) {
    setPlanId(nextPlanId);
    const plan = plansOptions.find((item) => item.id === nextPlanId);
    if (!plan) return;
    setAmount((plan.price / 100).toString());
    setRemainingSessions(plan.totalSessions.toString());
    if (startDate) {
      const nextEnd = new Date(startDate);
      nextEnd.setDate(nextEnd.getDate() + plan.validityDays);
      setEndDate(nextEnd.toISOString().split("T")[0]);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    if (needsAdjustmentReason && adjustmentReason.trim().length < 3) {
      setMessage("Indiquez un motif pour ajuster le montant ou les séances.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/member-subscriptions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscriptionId: subscription.id,
        payload: {
          planId,
          startDate: new Date(startDate).toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : null,
          amount: amountNum,
          remainingSessions: sessionsNum,
          status,
          ...(needsAdjustmentReason ? { adjustmentReason: adjustmentReason.trim() } : {}),
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la modification de l'abonnement");
      setLoading(false);
      return;
    }

    setMessage(status === "CANCELLED" ? "Abonnement résilié avec succès" : "Abonnement modifié avec succès");
    setLoading(false);
    setTimeout(() => router.push("/subscriptions"), 700);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 pb-4 lg:pb-0">
      <ReceptionInfoCard variant="warning" title="Correction admin">
        Toute modification du montant ou des séances exige un motif traçable dans le journal.
      </ReceptionInfoCard>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Membre</p>
        <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{subscription.memberName}</p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Plan *</label>
        <select value={planId} onChange={(e) => handlePlanChange(e.target.value)} className="field" required>
          {plansOptions.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} - {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(plan.price / 100)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Début *</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="field" required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Fin</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="field" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Montant (€) *</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="field" required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Séances restantes *</label>
          <input type="number" min="0" value={remainingSessions} onChange={(e) => setRemainingSessions(e.target.value)} className="field" required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Statut *</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusValue)} className="field" required>
            <option value="ACTIVE">Actif</option>
            <option value="DRAFT">Brouillon</option>
            <option value="EXPIRED">Expiré</option>
            <option value="CANCELLED">Résilié</option>
          </select>
        </div>
      </div>

      {needsAdjustmentReason && (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Motif de correction *</label>
          <textarea
            value={adjustmentReason}
            onChange={(e) => setAdjustmentReason(e.target.value)}
            className="field min-h-[80px]"
            placeholder="Ex. report séances convenu avec le responsable"
            required
          />
        </div>
      )}

      <FeedbackMessage message={message} />

      <FormActions sticky>
        <button type="button" onClick={() => router.push("/subscriptions")} className="btn btn-ghost btn-block-mobile">
          Annuler
        </button>
        <button type="button" onClick={() => setStatus("CANCELLED")} className="btn btn-danger btn-block-mobile">
          Marquer résilié
        </button>
        <button type="submit" disabled={loading} className="btn btn-primary btn-block-mobile">
          {loading ? "Enregistrement..." : "Enregistrer"}
        </button>
      </FormActions>
    </form>
  );
}
