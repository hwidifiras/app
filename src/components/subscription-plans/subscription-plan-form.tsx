"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { FeedbackMessage } from "@/components/ui/feedback-message";

type SportOption = { id: string; name: string };

export type SubscriptionPlanFormValues = {
  name: string;
  description: string | null;
  price: number;
  totalSessions: number;
  sessionsPerWeek: number | null;
  validityDays: number;
  sportId: string | null;
  isActive?: boolean;
};

type SubscriptionPlanFormProps = {
  mode: "create" | "edit";
  planId?: string;
  initialValues?: SubscriptionPlanFormValues;
};

export function SubscriptionPlanForm({ mode, planId, initialValues }: SubscriptionPlanFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [price, setPrice] = useState(
    initialValues ? (initialValues.price / 100).toFixed(2) : "",
  );
  const [totalSessions, setTotalSessions] = useState(
    initialValues?.totalSessions?.toString() ?? "12",
  );
  const [sessionsPerWeek, setSessionsPerWeek] = useState(
    initialValues?.sessionsPerWeek?.toString() ?? "3",
  );
  const [validityDays, setValidityDays] = useState(
    initialValues?.validityDays?.toString() ?? "30",
  );
  const [sportId, setSportId] = useState(initialValues?.sportId ?? "");
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [sports, setSports] = useState<SportOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sports")
      .then((res) => res.json())
      .then((data) => setSports(data.data || []))
      .catch(() => {});
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      price: Math.round(parseFloat(price || "0") * 100),
      totalSessions: parseInt(totalSessions, 10),
      sessionsPerWeek: sessionsPerWeek ? parseInt(sessionsPerWeek, 10) : undefined,
      validityDays: parseInt(validityDays, 10),
      sportId: sportId || undefined,
      isActive,
    };

    const response = await fetch("/api/subscription-plans", {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "create"
          ? payload
          : {
              planId,
              payload,
            },
      ),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? (mode === "create" ? "Erreur lors de la création du plan" : "Erreur lors de la modification du plan"));
      setLoading(false);
      return;
    }

    setMessage(mode === "create" ? "Plan créé avec succès" : "Plan modifié avec succès");
    setLoading(false);
    router.push("/subscription-plans");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Nom du plan *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Mensuel Standard" className="field" required />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Accès illimité, 1 coach..." className="field" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Prix (€) *</label>
          <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="field" required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Séances totales *</label>
          <input type="number" min="1" value={totalSessions} onChange={(e) => setTotalSessions(e.target.value)} className="field" required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Par semaine</label>
          <input type="number" min="1" max="7" value={sessionsPerWeek} onChange={(e) => setSessionsPerWeek(e.target.value)} className="field" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Validité (jours) *</label>
          <input type="number" min="1" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} className="field" required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Sport (Optionnel)</label>
          <select value={sportId} onChange={(e) => setSportId(e.target.value)} className="field">
            <option value="">Tous les sports</option>
            {sports.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {mode === "edit" ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Statut</label>
          <select value={String(isActive)} onChange={(e) => setIsActive(e.target.value === "true")} className="field">
            <option value="true">Actif</option>
            <option value="false">Inactif</option>
          </select>
        </div>
      ) : null}

      <FeedbackMessage message={message} />

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "Enregistrement..." : mode === "create" ? "Créer plan" : "Enregistrer les modifications"}
        </button>
        <button type="button" onClick={() => router.push("/subscription-plans")} className="btn btn-ghost">
          Annuler
        </button>
      </div>
    </form>
  );
}