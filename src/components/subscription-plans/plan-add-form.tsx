"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackMessage } from "@/components/ui/feedback-message";

export function PlanAddForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [totalSessions, setTotalSessions] = useState("12");
  const [sessionsPerWeek, setSessionsPerWeek] = useState("3");
  const [validityDays, setValidityDays] = useState("30");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/subscription-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        price: Math.round(parseFloat(price || "0") * 100),
        totalSessions: parseInt(totalSessions, 10),
        sessionsPerWeek: sessionsPerWeek ? parseInt(sessionsPerWeek, 10) : undefined,
        validityDays: parseInt(validityDays, 10),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error ?? "Erreur lors de la création du plan");
      setLoading(false);
      return;
    }

    setMessage("Plan créé avec succès");
    setLoading(false);

    setTimeout(() => {
      router.push("/subscription-plans");
    }, 800);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Nom du plan *</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Mensuel Standard" className="field" required />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Accès illimité, 1 coach..." className="field" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Prix (€) *</label>
          <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" className="field" required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Séances totales *</label>
          <input type="number" min="1" value={totalSessions} onChange={(e) => setTotalSessions(e.target.value)} className="field" required />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Par semaine</label>
          <input type="number" min="1" max="7" value={sessionsPerWeek} onChange={(e) => setSessionsPerWeek(e.target.value)} className="field" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Validité (jours) *</label>
        <input type="number" min="1" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} className="field" required />
      </div>

      <FeedbackMessage message={message} />

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={loading} className="btn btn-primary">
          {loading ? "Enregistrement..." : "Créer plan"}
        </button>
        <button type="button" onClick={() => router.push("/subscription-plans")} className="btn btn-ghost">
          Annuler
        </button>
      </div>
    </form>
  );
}
