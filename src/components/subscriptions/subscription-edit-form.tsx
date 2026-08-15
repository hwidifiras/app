"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SubscriptionCorrectionSummary } from "@/components/subscriptions/subscription-correction-summary";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions, FormSectionNav } from "@/components/ui/form-layout";
import { ReceptionInfoCard } from "@/components/ui/reception-info-card";
import { useIdempotencyIntent } from "@/hooks/use-idempotency-intent";
import { formatMoney } from "@/lib/money";

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
    totalPaid: number;
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
  const subscriptionIntent = useIdempotencyIntent();

  const amountNum = Math.round(parseFloat(amount || "0") * 100);
  const sessionsNum = Math.max(0, Math.round(Number(remainingSessions || 0)));
  const formulaChanged = planId !== subscription.planId;
  const statusChanged = status !== subscription.status;
  const needsAdjustmentReason =
    formulaChanged ||
    statusChanged ||
    amountNum !== subscription.amount ||
    sessionsNum !== subscription.remainingSessions;
  const amountBelowPaid = amountNum < subscription.totalPaid;

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
      setMessage("Indiquez un motif pour modifier la formule, le statut, le montant ou les séances.");
      setLoading(false);
      return;
    }

    if (amountBelowPaid) {
      setMessage("Le montant ne peut pas être inférieur au total déjà encaissé.");
      setLoading(false);
      return;
    }

    const requestPayload = {
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
    };
    let response: Response;
    try {
      response = await fetch("/api/member-subscriptions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": subscriptionIntent.keyFor(requestPayload),
        },
        body: JSON.stringify(requestPayload),
      });
    } catch {
      setLoading(false);
      setMessage("Connexion interrompue. Réessayez sans risque de doubler la correction.");
      return;
    }

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la modification de l'abonnement");
      setLoading(false);
      return;
    }
    subscriptionIntent.complete(requestPayload);

    router.push("/subscriptions");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 pb-4 lg:pb-0">
      <ReceptionInfoCard variant="warning" title="Correction admin">
        Toute modification de formule, statut, montant ou séances exige un motif traçable dans le journal.
      </ReceptionInfoCard>

      <SubscriptionCorrectionSummary
        totalPaidCents={subscription.totalPaid}
        originalAmountCents={subscription.amount}
        proposedAmountCents={amountNum}
        originalRemainingSessions={subscription.remainingSessions}
        proposedRemainingSessions={sessionsNum}
        formulaChanged={formulaChanged}
        statusChanged={statusChanged}
        needsAdjustmentReason={needsAdjustmentReason}
        amountBelowPaid={amountBelowPaid}
      />

      <FormSectionNav
        items={[
          { href: "#subscription-member", label: "Membre" },
          { href: "#subscription-plan", label: "Formule" },
          { href: "#subscription-period", label: "Période" },
          { href: "#subscription-values", label: "Valeurs" },
        ]}
      />

      <div id="subscription-member" className="form-section-anchor rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Membre</p>
        <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{subscription.memberName}</p>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
            <span className="block font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              Déjà encaissé
            </span>
            <span className="mt-1 block text-sm font-bold text-[var(--foreground)]">{formatMoney(subscription.totalPaid)}</span>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
            <span className="block font-semibold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
              Montant minimum
            </span>
            <span className="mt-1 block text-sm font-bold text-[var(--foreground)]">{formatMoney(subscription.totalPaid)}</span>
          </div>
        </div>
      </div>

      <div id="subscription-plan" className="form-section-anchor">
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Plan *</label>
        <select value={planId} onChange={(e) => handlePlanChange(e.target.value)} className="field" required>
          {plansOptions.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} - {formatMoney(plan.price)}
            </option>
          ))}
        </select>
      </div>

      <div id="subscription-period" className="form-section-anchor grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Début *</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="field" required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Fin</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="field" />
        </div>
      </div>

      <div id="subscription-values" className="form-section-anchor grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Montant (TND) *</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`field ${amountBelowPaid ? "border-[var(--danger)] ring-1 ring-[var(--danger)]" : ""}`}
            required
          />
          {amountBelowPaid ? (
            <p className="mt-1 text-xs font-medium text-[var(--danger)]">
              Minimum: {formatMoney(subscription.totalPaid)} déjà encaissé.
            </p>
          ) : null}
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
        <div id="subscription-reason" className="form-section-anchor">
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
          Préparer résiliation
        </button>
        <button type="submit" disabled={loading || amountBelowPaid} className="btn btn-primary btn-block-mobile">
          {loading ? "Enregistrement..." : "Enregistrer la correction"}
        </button>
      </FormActions>
    </form>
  );
}
