"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Dumbbell, Loader2, Plus, SlidersHorizontal, X } from "lucide-react";

import type { OnboardingActivitiesInput, TenantOnboardingState } from "@/components/onboarding/onboarding-types";
import { cn } from "@/lib/utils";

function uniqueNames(names: string[]) {
  const values = new Map<string, string>();
  for (const value of names) {
    const name = value.replace(/\s+/g, " ").trim();
    if (name) values.set(name.toLocaleLowerCase("fr"), name);
  }
  return [...values.values()];
}

export function OnboardingActivitiesStep({
  state,
  saving,
  onBack,
  onContinue,
}: {
  state: TenantOnboardingState;
  saving: boolean;
  onBack: () => void;
  onContinue: (input: OnboardingActivitiesInput) => Promise<void>;
}) {
  const hasClasses = state.modules.includes("CLASS_MANAGEMENT");
  const hasGym = state.modules.includes("GYM_ACCESS");
  const [templateKeys, setTemplateKeys] = useState(state.selectedTemplateKeys);
  const [disciplineNames, setDisciplineNames] = useState(uniqueNames(state.selectedDisciplineNames));
  const [customName, setCustomName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [showAllTemplates, setShowAllTemplates] = useState(state.selectedTemplateKeys.length === 0);
  const visibleTemplates = showAllTemplates
    ? state.templates
    : state.templates.filter((template) => templateKeys.includes(template.key));

  function toggleTemplate(key: string) {
    setLocalError(null);
    if (templateKeys.includes(key)) {
      setTemplateKeys((current) => current.filter((entry) => entry !== key));
      return;
    }
    if (templateKeys.length >= 3) {
      setLocalError("Vous pouvez combiner jusqu'à 3 modèles.");
      return;
    }
    const template = state.templates.find((entry) => entry.key === key);
    setTemplateKeys((current) => [...current, key]);
    if (hasClasses && template) {
      setDisciplineNames((current) => uniqueNames([...current, ...template.suggestedDisciplines]));
    }
  }

  function addCustomDiscipline() {
    const normalized = customName.replace(/\s+/g, " ").trim();
    if (normalized.length < 2) return;
    if (disciplineNames.length >= 20) {
      setLocalError("La configuration initiale accepte jusqu'à 20 disciplines.");
      return;
    }
    setDisciplineNames((current) => uniqueNames([...current, normalized]));
    setCustomName("");
    setLocalError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (hasClasses && disciplineNames.length === 0) {
      setLocalError("Choisissez au moins une discipline.");
      return;
    }
    await onContinue({ action: "ACTIVITIES", templateKeys, disciplineNames: hasClasses ? disciplineNames : [] });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset>
        <legend className="text-sm font-bold">Quel modèle se rapproche de votre club ?</legend>
        <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">Ce choix prépare des suggestions. Il ne verrouille ni vos activités ni vos futurs abonnements.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visibleTemplates.map((template) => {
            const selected = templateKeys.includes(template.key);
            return (
              <button key={template.key} type="button" aria-pressed={selected} onClick={() => toggleTemplate(template.key)} className={cn("flex min-h-24 items-start gap-3 rounded-lg border p-3 text-left transition", selected ? "border-[var(--primary)] bg-[var(--info-surface)]" : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--primary)]/45")}>
                <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border", selected ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] text-transparent")}><Check className="size-3.5" /></span>
                <span><span className="block text-sm font-bold">{template.label}</span><span className="mt-1 block text-xs leading-5 text-[var(--muted-foreground)]">{template.description}</span></span>
              </button>
            );
          })}
        </div>
        {state.templates.length > visibleTemplates.length ? (
          <button type="button" className="btn btn-ghost mt-3" onClick={() => setShowAllTemplates(true)}>
            <SlidersHorizontal className="size-4" />Changer ou ajouter un modèle
          </button>
        ) : showAllTemplates && templateKeys.length > 0 ? (
          <button type="button" className="mt-3 text-xs font-bold text-[var(--primary)] hover:underline" onClick={() => setShowAllTemplates(false)}>
            Afficher seulement mes choix
          </button>
        ) : null}
      </fieldset>

      {hasClasses ? (
        <fieldset className="border-t border-[var(--border)] pt-5">
          <legend className="text-sm font-bold">Disciplines à préparer</legend>
          <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">Gardez uniquement les disciplines réellement proposées. Vous pourrez en ajouter ou les désactiver plus tard.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {disciplineNames.map((name) => (
              <span key={name.toLocaleLowerCase("fr")} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--primary)]/30 bg-[var(--info-surface)] px-3 text-sm font-semibold text-[var(--primary)]">
                {name}
                <button type="button" onClick={() => setDisciplineNames((current) => current.filter((entry) => entry !== name))} className="rounded p-0.5 hover:bg-white" aria-label={`Retirer ${name}`}><X className="size-3.5" /></button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input className="field" value={customName} onChange={(event) => setCustomName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomDiscipline(); } }} placeholder="Ajouter une discipline" maxLength={80} />
            <button type="button" className="btn btn-ghost shrink-0" onClick={addCustomDiscipline} disabled={customName.trim().length < 2}><Plus className="size-4" />Ajouter</button>
          </div>
        </fieldset>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <Dumbbell className="mt-0.5 size-5 shrink-0" />
          <div><p className="font-bold">Configuration salle uniquement</p><p className="mt-1 text-sm leading-5">Aucune discipline, aucun coach et aucun groupe ne seront imposés. Vous commencerez directement par vos pass et vos accès.</p></div>
        </div>
      )}

      {hasGym ? <p className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-xs leading-5 text-[#1E3A8A]">L’accès salle est indépendant des séances de cours. Un pack hybride pourra réunir les deux sans mélanger leurs compteurs.</p> : null}
      {localError ? <p role="alert" className="text-sm font-semibold text-red-700">{localError}</p> : null}

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:justify-between">
        <button type="button" className="btn btn-ghost" onClick={onBack} disabled={saving}><ArrowLeft className="size-4" />Retour</button>
        <button type="submit" className="btn btn-primary btn-lg" disabled={saving || (hasClasses && disciplineNames.length === 0)}>{saving ? <><Loader2 className="size-4 animate-spin" />Enregistrement...</> : <>Continuer<ArrowRight className="size-4" /></>}</button>
      </div>
    </form>
  );
}
