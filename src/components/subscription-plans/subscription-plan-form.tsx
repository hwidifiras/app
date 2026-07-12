"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Dumbbell, Layers3, Plus, Trash2 } from "lucide-react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";
import { ReceptionInfoCard } from "@/components/ui/reception-info-card";

type SportOption = { id: string; name: string };
type PlanKind = "CLASS" | "GYM" | "MIXED";
type ClassRight = { sportId: string; sessionsPerWeek: number; grantedUnits: number };

export type SubscriptionPlanFormValues = {
  name: string;
  description: string | null;
  price: number;
  totalSessions: number;
  sessionsPerWeek: number | null;
  validityDays: number;
  sportId: string | null;
  planKind?: PlanKind;
  entitlements?: Array<{
    type: "CLASS_SESSIONS" | "GYM_ACCESS";
    sportId: string | null;
    sessionsPerWeek: number | null;
    grantedUnits: number | null;
    gymAccessMode: "UNLIMITED" | "VISIT_QUOTA" | null;
  }>;
  isActive?: boolean;
};

export function SubscriptionPlanForm({
  mode,
  planId,
  initialValues,
  gymModuleEnabled = false,
}: {
  mode: "create" | "edit";
  planId?: string;
  initialValues?: SubscriptionPlanFormValues;
  gymModuleEnabled?: boolean;
}) {
  const router = useRouter();
  const initialKind = initialValues?.planKind ?? "CLASS";
  const initialClassRights = initialValues?.entitlements?.filter((item) => item.type === "CLASS_SESSIONS").map((item) => ({
    sportId: item.sportId ?? "",
    sessionsPerWeek: item.sessionsPerWeek ?? 3,
    grantedUnits: item.grantedUnits ?? (item.sessionsPerWeek ?? 3) * 4,
  })) ?? (initialValues?.sportId ? [{ sportId: initialValues.sportId, sessionsPerWeek: initialValues.sessionsPerWeek ?? 3, grantedUnits: initialValues.totalSessions }] : [{ sportId: "", sessionsPerWeek: 3, grantedUnits: 12 }]);
  const initialGym = initialValues?.entitlements?.find((item) => item.type === "GYM_ACCESS");

  const [planKind, setPlanKind] = useState<PlanKind>(initialKind);
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [price, setPrice] = useState(initialValues ? (initialValues.price / 100).toFixed(2) : "");
  const [validityDays, setValidityDays] = useState(String(initialValues?.validityDays ?? 30));
  const [classRights, setClassRights] = useState<ClassRight[]>(initialClassRights);
  const [gymAccessMode, setGymAccessMode] = useState<"UNLIMITED" | "VISIT_QUOTA">(initialGym?.gymAccessMode ?? "UNLIMITED");
  const [gymVisitQuota, setGymVisitQuota] = useState(String(initialGym?.grantedUnits ?? 12));
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [sports, setSports] = useState<SportOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/sports").then((response) => response.json()).then((json) => setSports(json.data ?? [])).catch(() => {});
  }, []);

  const entitlements = useMemo(() => {
    const classItems = (planKind === "CLASS" || planKind === "MIXED")
      ? classRights.map((right) => ({ type: "CLASS_SESSIONS" as const, sportId: right.sportId, sessionsPerWeek: right.sessionsPerWeek, grantedUnits: right.grantedUnits, gymAccessMode: null }))
      : [];
    const gymItems = (planKind === "GYM" || planKind === "MIXED")
      ? [{ type: "GYM_ACCESS" as const, sportId: null, sessionsPerWeek: null, grantedUnits: gymAccessMode === "VISIT_QUOTA" ? Number(gymVisitQuota) : null, gymAccessMode }]
      : [];
    return [...classItems, ...gymItems];
  }, [classRights, gymAccessMode, gymVisitQuota, planKind]);

  function changeKind(next: PlanKind) {
    if (next !== "CLASS" && !gymModuleEnabled) return;
    setPlanKind(next);
    setMessage(null);
    if ((next === "CLASS" || next === "MIXED") && classRights.length === 0) {
      setClassRights([{ sportId: "", sessionsPerWeek: 3, grantedUnits: 12 }]);
    }
  }

  function updateClassRight(index: number, patch: Partial<ClassRight>) {
    setClassRights((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      price: Math.round(Number(price.replace(",", ".")) * 100),
      validityDays: Number(validityDays),
      planKind,
      entitlements,
      isActive,
    };
    const response = await fetch("/api/subscription-plans", {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "create" ? payload : { planId, payload }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Enregistrement impossible");
      setLoading(false);
      return;
    }
    router.push("/subscription-plans");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 pb-4">
      <ReceptionInfoCard title="Ce que le membre achète" variant="info">
        Une formule peut donner accès aux cours, à la salle, ou réunir les deux dans un seul abonnement et un seul paiement.
      </ReceptionInfoCard>

      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Type de formule">
        {[
          { value: "CLASS" as const, label: "Cours collectifs", icon: BookOpen, disabled: false },
          { value: "GYM" as const, label: "Accès salle", icon: Dumbbell, disabled: !gymModuleEnabled },
          { value: "MIXED" as const, label: "Pack mixte", icon: Layers3, disabled: !gymModuleEnabled },
        ].map((option) => {
          const Icon = option.icon;
          return (
            <button key={option.value} type="button" disabled={option.disabled} onClick={() => changeKind(option.value)} className={`flex min-h-14 items-center gap-2 rounded-lg border px-3 text-left text-sm font-semibold transition ${planKind === option.value ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-soft)]"}`}>
              <Icon className="size-4" /> {option.label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Nom de la formule *</span><input className="field" value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label><span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Prix (TND) *</span><input className="field" type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} required /></label>
        <label><span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Validité (jours) *</span><input className="field" type="number" min="1" max="3650" value={validityDays} onChange={(event) => setValidityDays(event.target.value)} required /></label>
        <label className="sm:col-span-2"><span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Description</span><textarea className="field min-h-20 resize-y py-2" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      </div>

      {planKind === "CLASS" || planKind === "MIXED" ? (
        <section className="border-t border-[var(--border)] pt-5">
          <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-semibold">Droits cours</h2><p className="text-xs text-[var(--muted-foreground)]">Une ligne par discipline incluse.</p></div>{planKind === "MIXED" ? <button type="button" className="btn btn-ghost" onClick={() => setClassRights((current) => [...current, { sportId: "", sessionsPerWeek: 2, grantedUnits: 8 }])}><Plus className="size-4" /> Discipline</button> : null}</div>
          <div className="space-y-3">
            {classRights.map((right, index) => (
              <div key={index} className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3 sm:grid-cols-[minmax(0,1fr)_9rem_9rem_auto] sm:items-end">
                <label><span className="mb-1 block text-xs font-medium">Discipline</span><select className="field" value={right.sportId} onChange={(event) => updateClassRight(index, { sportId: event.target.value })} required><option value="">Choisir</option>{sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label>
                <label><span className="mb-1 block text-xs font-medium">Par semaine</span><input className="field" type="number" min="1" max="7" value={right.sessionsPerWeek} onChange={(event) => { const weekly = Number(event.target.value); updateClassRight(index, { sessionsPerWeek: weekly, grantedUnits: weekly * 4 }); }} required /></label>
                <label><span className="mb-1 block text-xs font-medium">Séances incluses</span><input className="field" type="number" min="1" value={right.grantedUnits} onChange={(event) => updateClassRight(index, { grantedUnits: Number(event.target.value) })} required /></label>
                {classRights.length > 1 ? <button type="button" className="btn btn-ghost text-red-600" aria-label="Retirer la discipline" onClick={() => setClassRights((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="size-4" /></button> : <span />}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {planKind === "GYM" || planKind === "MIXED" ? (
        <section className="border-t border-[var(--border)] pt-5">
          <h2 className="font-semibold">Droit salle</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label><span className="mb-1 block text-xs font-medium">Mode d&apos;accès</span><select className="field" value={gymAccessMode} onChange={(event) => setGymAccessMode(event.target.value as typeof gymAccessMode)}><option value="UNLIMITED">Accès illimité</option><option value="VISIT_QUOTA">Quota de visites</option></select></label>
            {gymAccessMode === "VISIT_QUOTA" ? <label><span className="mb-1 block text-xs font-medium">Visites incluses</span><input className="field" type="number" min="1" value={gymVisitQuota} onChange={(event) => setGymVisitQuota(event.target.value)} required /></label> : <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Entrées illimitées pendant la validité.</div>}
          </div>
        </section>
      ) : null}

      {mode === "edit" ? <label className="block border-t border-[var(--border)] pt-5"><span className="mb-1 block text-xs font-medium">Statut</span><select className="field" value={String(isActive)} onChange={(event) => setIsActive(event.target.value === "true")}><option value="true">Actif</option><option value="false">Inactif</option></select></label> : null}
      <FeedbackMessage message={message} />
      <FormActions sticky><button type="button" className="btn btn-ghost btn-block-mobile" onClick={() => router.push("/subscription-plans")}>Annuler</button><button type="submit" className="btn btn-primary btn-block-mobile" disabled={loading}>{loading ? "Enregistrement..." : mode === "create" ? "Créer la formule" : "Enregistrer"}</button></FormActions>
    </form>
  );
}
