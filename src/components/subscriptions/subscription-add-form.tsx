"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";

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
  createdAt: string;
};

type SubscriptionAddFormProps = {
  membersOptions: MemberOption[];
  plansOptions: PlanOption[];
};

export function SubscriptionAddForm({ membersOptions, plansOptions }: SubscriptionAddFormProps) {
  const router = useRouter();
  const [memberId, setMemberId] = useState("");
  const [planId, setPlanId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SubscriptionPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedPlan = plansOptions.find((p) => p.id === planId);

  useEffect(() => {
    if (!memberId) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
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
          createdAt: string;
        }>;

        const latest = rows[0];
        if (!latest) {
          setPreview(null);
          return;
        }

        setPreview({
          id: latest.id,
          status: latest.status,
          startDate: latest.startDate,
          endDate: latest.endDate,
          amount: latest.amount,
          remainingSessions: latest.remainingSessions,
          totalPaid: latest.payments.reduce((sum, payment) => sum + payment.amount, 0),
          planName: latest.plan.name,
          totalSessions: latest.plan.totalSessions,
          createdAt: latest.createdAt,
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

  function handlePlanChange(nextPlanId: string) {
    setPlanId(nextPlanId);
    const plan = plansOptions.find((p) => p.id === nextPlanId);
    if (plan) {
      setAmount((plan.price / 100).toString());
      if (startDate && plan.validityDays) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + plan.validityDays);
        setEndDate(d.toISOString().split("T")[0]);
      }
    }
  }

  function handleStartDateChange(date: string) {
    setStartDate(date);
    if (selectedPlan && selectedPlan.validityDays && date) {
      const d = new Date(date);
      d.setDate(d.getDate() + selectedPlan.validityDays);
      setEndDate(d.toISOString().split("T")[0]);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const payload = {
      memberId,
      planId,
      startDate: new Date(startDate).toISOString(),
      endDate: endDate ? new Date(endDate).toISOString() : null,
    };

    const response = await fetch("/api/member-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors du renouvellement de l'abonnement");
      setLoading(false);
      return;
    }

    setMessage("Renouvellement enregistré avec succès");
    setLoading(false);

    setTimeout(() => {
      router.push("/subscriptions");
    }, 800);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
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

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Historique du membre
        </p>
        {previewLoading ? (
          <p className="text-sm text-[var(--muted-foreground)]">Chargement de l&apos;abonnement récent...</p>
        ) : previewError ? (
          <p className="text-sm text-[var(--danger)]">{previewError}</p>
        ) : preview ? (
          <div className="space-y-1 text-sm">
            <p className="font-medium text-[var(--foreground)]">
              Dernier abonnement: {preview.planName} ({preview.status === "ACTIVE" ? "actif" : preview.status === "EXPIRED" ? "expiré" : preview.status === "CANCELLED" ? "annulé" : "brouillon"})
            </p>
            <p className="text-[var(--muted-foreground)]">
              Début {new Date(preview.startDate).toLocaleDateString("fr-FR")} · Fin {preview.endDate ? new Date(preview.endDate).toLocaleDateString("fr-FR") : "—"}
            </p>
            <p className="text-[var(--muted-foreground)]">
              Séances restantes: {preview.remainingSessions} / {preview.totalSessions} · Payé: {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(preview.totalPaid / 100)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)]">
            Aucun historique d&apos;abonnement trouvé pour ce membre.
          </p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Plan d&apos;abonnement *</label>
        <select value={planId} onChange={(e) => handlePlanChange(e.target.value)} className="field" required>
          <option value="">Sélectionner un plan</option>
          {plansOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(p.price / 100)} / {p.totalSessions} séances
            </option>
          ))}
        </select>
        {selectedPlan && (
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {selectedPlan.totalSessions} séances — Validité {selectedPlan.validityDays}j — Montant suggéré: {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(selectedPlan.price / 100)}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Date de début *</label>
          <input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className="field" required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Date de fin</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="field" />
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">Auto-calculée selon le plan</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Montant (€) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="field"
            required
          />
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">Rappel</p>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Ce formulaire crée un nouvel abonnement et clôture automatiquement l&apos;abonnement actif précédent pour garder l&apos;historique.
          </p>
        </div>
      </div>

      <FeedbackMessage message={message} />

      <FormActions sticky>
        <button type="button" onClick={() => router.push("/subscriptions")} className="btn btn-ghost btn-block-mobile">
          Annuler
        </button>
        <button type="submit" disabled={loading} className="btn btn-primary btn-block-mobile">
          {loading ? "Enregistrement..." : "Renouveler l'abonnement"}
        </button>
      </FormActions>
    </form>
  );
}
