"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";
import { ReceptionInfoCard } from "@/components/ui/reception-info-card";

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
  const [sessionsPerWeek, setSessionsPerWeek] = useState(
    initialValues?.sessionsPerWeek?.toString() ?? "3",
  );
  const computedTotalSessions = (parseInt(sessionsPerWeek, 10) || 0) * 4;
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
      sessionsPerWeek: parseInt(sessionsPerWeek, 10),
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

  function applyTemplate(months: 1 | 2 | 3) {
    const spw = parseInt(sessionsPerWeek, 10) || 3;
    setName(months === 1 ? "Formule 1 mois" : months === 2 ? "Formule 2 mois" : "Formule 3 mois");
    setValidityDays(String(months * 30));
    setSessionsPerWeek(String(spw));

    const currentPrice = parseFloat(price.replace(",", ".")) || 0;
    const currentDays = parseInt(validityDays, 10) || 30;
    if (currentPrice > 0 && currentDays > 0) {
      const monthlyRate = currentPrice / (currentDays / 30);
      setPrice((monthlyRate * months).toFixed(2));
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 pb-4 lg:pb-0">
      <ReceptionInfoCard title="Formules" variant="info">
        Une formule fixe le prix, le quota de séances ({computedTotalSessions || 0} avec {sessionsPerWeek || 0}/sem.) et la validité.
        Pour 2 mois, préférez une formule 2 mois plutôt qu&apos;un double paiement.
      </ReceptionInfoCard>

      {mode === "create" && (
        <div className="flex flex-wrap gap-2">
          {([1, 2, 3] as const).map((months) => (
            <button
              key={months}
              type="button"
              className="btn btn-secondary min-h-10 flex-1 text-xs sm:flex-none sm:text-sm"
              onClick={() => applyTemplate(months)}
            >
              Modèle {months} mois
            </button>
          ))}
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Nom du plan *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Mensuel Standard" className="field" required />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Prix (€) *</label>
          <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="field" required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Séances par semaine *</label>
          <input type="number" min="1" max="7" value={sessionsPerWeek} onChange={(e) => setSessionsPerWeek(e.target.value)} className="field" required />
          <p className="mt-1 text-xs text-muted-foreground">
            Quota pack : {computedTotalSessions || 0} séances (×4 semaines).
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Validité (jours) *</label>
          <input type="number" min="1" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} className="field" required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Discipline *</label>
          <select value={sportId} onChange={(e) => setSportId(e.target.value)} className="field" required>
            <option value="">Choisir une discipline</option>
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

      <FormActions sticky>
        <button type="button" onClick={() => router.push("/subscription-plans")} className="btn btn-ghost btn-block-mobile">
          Annuler
        </button>
        <button type="submit" disabled={loading} className="btn btn-primary btn-block-mobile">
          {loading ? "Enregistrement..." : mode === "create" ? "Créer plan" : "Enregistrer les modifications"}
        </button>
      </FormActions>
    </form>
  );
}