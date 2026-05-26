"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";
import { ReceptionInfoCard, SubscriptionBillingSummary } from "@/components/ui/reception-info-card";

type MemberOption = { id: string; firstName: string; lastName: string; phone: string };
type PlanOption = { id: string; name: string; price: number; totalSessions: number; validityDays: number };
type SubscriptionPreview = {
  id: string;
  status: string;
  startDate: string;
  endDate: string | null;
  amount: number;
  remainingSessions: number;
  totalPaid: number;
  planName: string;
  totalSessions: number;
};

type SubscriptionAddFormProps = {
  membersOptions: MemberOption[];
  plansOptions: PlanOption[];
};

function formatEur(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export function SubscriptionAddForm({ membersOptions, plansOptions }: SubscriptionAddFormProps) {
  const router = useRouter();
  const [memberId, setMemberId] = useState("");
  const [planId, setPlanId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [paymentCents, setPaymentCents] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [carryOverRemainingSessions, setCarryOverRemainingSessions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SubscriptionPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedPlan = plansOptions.find((p) => p.id === planId);
  const paymentNum = Math.round(parseFloat(paymentCents.replace(",", ".")) * 100) || 0;
  const canCarryOver = preview?.status === "ACTIVE" && preview.remainingSessions > 0;
  const paymentTooHigh = selectedPlan ? paymentNum > selectedPlan.price : false;

  useEffect(() => {
    if (!memberId) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      setCarryOverRemainingSessions(false);
      return;
    }

    const controller = new AbortController();
    setPreviewLoading(true);
    setPreviewError(null);

    fetch(`/api/member-subscriptions?memberId=${memberId}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Impossible de charger l'historique");
        }

        const rows = (payload.data ?? []) as Array<{
          id: string;
          status: string;
          startDate: string;
          endDate: string | null;
          amount: number;
          remainingSessions: number;
          plan: { name: string; totalSessions: number };
          payments: Array<{ amount: number }>;
        }>;

        const active = rows.find((row) => row.status === "ACTIVE") ?? rows[0];
        if (!active) {
          setPreview(null);
          return;
        }

        setPreview({
          id: active.id,
          status: active.status,
          startDate: active.startDate,
          endDate: active.endDate,
          amount: active.amount,
          remainingSessions: active.remainingSessions,
          totalPaid: active.payments.reduce((sum, payment) => sum + payment.amount, 0),
          planName: active.plan.name,
          totalSessions: active.plan.totalSessions,
        });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPreview(null);
        setPreviewError(error instanceof Error ? error.message : "Erreur de chargement");
      })
      .finally(() => {
        setPreviewLoading(false);
      });

    return () => controller.abort();
  }, [memberId]);

  useEffect(() => {
    if (!canCarryOver) setCarryOverRemainingSessions(false);
  }, [canCarryOver]);

  function handlePlanChange(nextPlanId: string) {
    setPlanId(nextPlanId);
    const plan = plansOptions.find((p) => p.id === nextPlanId);
    if (plan) {
      setPaymentCents((plan.price / 100).toFixed(2));
      if (startDate && plan.validityDays) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + plan.validityDays);
        setEndDate(d.toISOString().split("T")[0]);
      }
    }
  }

  function handleStartDateChange(date: string) {
    setStartDate(date);
    if (selectedPlan?.validityDays && date) {
      const d = new Date(date);
      d.setDate(d.getDate() + selectedPlan.validityDays);
      setEndDate(d.toISOString().split("T")[0]);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (paymentTooHigh) {
      setMessage("Le paiement ne peut pas dépasser le montant de la formule.");
      return;
    }

    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/member-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberId,
        planId,
        startDate: new Date(startDate).toISOString(),
        carryOverRemainingSessions: carryOverRemainingSessions || undefined,
        paymentCents: paymentNum > 0 ? paymentNum : undefined,
        paymentMethod,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors du renouvellement de l'abonnement");
      setLoading(false);
      return;
    }

    setMessage("Renouvellement enregistré avec succès");
    setLoading(false);
    setTimeout(() => router.push("/subscriptions"), 800);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 pb-4 lg:pb-0">
      <ReceptionInfoCard title="Renouvellement" variant="info">
        <p>Crée une nouvelle période avec le quota de la formule choisie.</p>
        <p>Le paiement ici ne peut pas dépasser le prix de la formule.</p>
      </ReceptionInfoCard>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Membre *</label>
        <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className="field" required>
          <option value="">Sélectionner un membre</option>
          {membersOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.firstName} {m.lastName} — {m.phone}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Abonnement actuel
        </p>
        {previewLoading ? (
          <p className="text-sm text-[var(--muted-foreground)]">Chargement…</p>
        ) : previewError ? (
          <p className="text-sm text-[var(--danger)]">{previewError}</p>
        ) : preview ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">{preview.planName}</p>
            <SubscriptionBillingSummary
              amountDueCents={preview.amount}
              totalPaidCents={preview.totalPaid}
              remainingSessions={preview.remainingSessions}
              totalSessions={preview.totalSessions}
              endDateLabel={preview.endDate ? new Date(preview.endDate).toLocaleDateString("fr-FR") : undefined}
            />
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">Aucun abonnement existant.</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Formule *</label>
        <select value={planId} onChange={(e) => handlePlanChange(e.target.value)} className="field" required>
          <option value="">Sélectionner une formule</option>
          {plansOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {formatEur(p.price)} · {p.totalSessions} séances · {p.validityDays}j
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Début *</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="field"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Fin (auto)</label>
          <input type="date" value={endDate} readOnly className="field bg-[var(--surface-soft)]" />
        </div>
      </div>

      {canCarryOver && selectedPlan && (
        <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0"
            checked={carryOverRemainingSessions}
            onChange={(e) => setCarryOverRemainingSessions(e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-semibold">Reporter {preview?.remainingSessions} séance(s) non utilisées</span>
            <span className="mt-1 block text-xs text-[var(--muted-foreground)]">
              Nouveau quota : {selectedPlan.totalSessions + (preview?.remainingSessions ?? 0)} séances
            </span>
          </span>
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Paiement initial (€)</label>
          <input
            type="text"
            inputMode="decimal"
            value={paymentCents}
            onChange={(e) => setPaymentCents(e.target.value)}
            className={`field ${paymentTooHigh ? "border-[var(--danger)] ring-1 ring-[var(--danger)]" : ""}`}
            placeholder="0,00"
          />
          {selectedPlan && (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Maximum {formatEur(selectedPlan.price)}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Méthode</label>
          <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="field">
            <option value="CASH">Espèces</option>
            <option value="CARD">Carte</option>
            <option value="TRANSFER">Virement</option>
            <option value="CHECK">Chèque</option>
          </select>
        </div>
      </div>

      <FeedbackMessage message={message} />

      <FormActions sticky>
        <button type="button" onClick={() => router.push("/subscriptions")} className="btn btn-ghost btn-block-mobile">
          Annuler
        </button>
        <button type="submit" disabled={loading || paymentTooHigh} className="btn btn-primary btn-block-mobile">
          {loading ? "Enregistrement..." : "Renouveler"}
        </button>
      </FormActions>
    </form>
  );
}
