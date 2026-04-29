"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackMessage } from "@/components/ui/feedback-message";

type GroupOption = { id: string; name: string };
type PlanOption = { id: string; name: string; price: number; totalSessions: number; validityDays: number };

type MemberAddFormProps = {
  groupsOptions: GroupOption[];
  plansOptions: PlanOption[];
};

export function MemberAddForm({ groupsOptions, plansOptions }: MemberAddFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [groupId, setGroupId] = useState("");
  const [planId, setPlanId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedPlan = plansOptions.find((p) => p.id === planId);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const payload: Record<string, unknown> = { firstName, lastName, phone, email };
    if (groupId) payload.groupId = groupId;
    if (planId) payload.subscriptionPlanId = planId;

    const response = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la création du membre");
      setLoading(false);
      return;
    }

    setMessage("Inscription créée avec succès");
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setGroupId("");
    setPlanId("");
    setLoading(false);

    setTimeout(() => {
      router.push("/members");
    }, 800);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Prénom *</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="ex: Mohamed"
            className="field"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Nom *</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="ex: Benali"
            className="field"
            required
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Téléphone *</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="06 00 00 00 00"
            className="field"
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="optionnel"
            className="field"
          />
        </div>
      </div>

      <div className="border-t border-[var(--border)] pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Affectation & Abonnement
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Groupe</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="field"
            >
              <option value="">Aucun</option>
              {groupsOptions.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Plan d&apos;abonnement</label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="field"
            >
              <option value="">Aucun</option>
              {plansOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(p.price / 100)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedPlan && (
          <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
            <p className="text-xs text-[var(--muted-foreground)]">
              <span className="font-medium text-[var(--foreground)]">{selectedPlan.name}</span> —{" "}
              {selectedPlan.totalSessions} séances — Validité {selectedPlan.validityDays} jours —{" "}
              {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(selectedPlan.price / 100)}
            </p>
          </div>
        )}
      </div>

      <FeedbackMessage message={message} />

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "Enregistrement..." : "Inscrire membre"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/members")}
          className="btn btn-ghost"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
