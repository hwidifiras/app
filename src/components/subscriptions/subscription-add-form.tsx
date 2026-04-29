"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackMessage } from "@/components/ui/feedback-message";

type MemberOption = { id: string; firstName: string; lastName: string; phone: string };
type PlanOption = { id: string; name: string; price: number; totalSessions: number; validityDays: number };

type SubscriptionAddFormProps = {
  membersOptions: MemberOption[];
  plansOptions: PlanOption[];
};

export function SubscriptionAddForm({ membersOptions, plansOptions }: SubscriptionAddFormProps) {
  const router = useRouter();
  const [memberId, setMemberId] = useState("");
  const [planId, setPlanId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedPlan = plansOptions.find((p) => p.id === planId);

  function handlePlanChange(planId: string) {
    setPlanId(planId);
    const plan = plansOptions.find((p) => p.id === planId);
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
      startDate: startDate ? new Date(startDate).toISOString() : null,
      endDate: endDate ? new Date(endDate).toISOString() : null,
      amount: Math.round(parseFloat(amount || "0") * 100),
      status,
    };

    const response = await fetch("/api/member-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la création de l'abonnement");
      setLoading(false);
      return;
    }

    setMessage("Abonnement créé avec succès");
    setLoading(false);

    setTimeout(() => {
      router.push("/subscriptions");
    }, 800);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Membre *</label>
        <select
          value={memberId}
          onChange={(e) => setMemberId(e.target.value)}
          className="field"
          required
        >
          <option value="">Sélectionner un membre</option>
          {membersOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.firstName} {m.lastName} — {m.phone}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Plan d&apos;abonnement *</label>
        <select
          value={planId}
          onChange={(e) => handlePlanChange(e.target.value)}
          className="field"
          required
        >
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
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="field"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Date de fin</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="field"
          />
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
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Statut</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="field">
            <option value="DRAFT">Brouillon</option>
            <option value="ACTIVE">Actif</option>
            <option value="EXPIRED">Expiré</option>
            <option value="CANCELLED">Annulé</option>
          </select>
        </div>
      </div>

      <FeedbackMessage message={message} />

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "Enregistrement..." : "Créer abonnement"}
        </button>
        <button type="button" onClick={() => router.push("/subscriptions")} className="btn btn-ghost">
          Annuler
        </button>
      </div>
    </form>
  );
}
