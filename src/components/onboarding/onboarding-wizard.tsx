"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { OnboardingActivitiesStep } from "@/components/onboarding/onboarding-activities-step";
import { OnboardingPoliciesStep } from "@/components/onboarding/onboarding-policies-step";
import { OnboardingProfileStep } from "@/components/onboarding/onboarding-profile-step";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { OnboardingReviewStep } from "@/components/onboarding/onboarding-review-step";
import type { OnboardingMutationInput, TenantOnboardingState } from "@/components/onboarding/onboarding-types";
import { FeedbackMessage } from "@/components/ui/feedback-message";

const STEP_CONTENT = [
  { eyebrow: "Votre club", title: "Les bases utiles", description: "Quelques informations visibles par votre équipe et sur les documents du club." },
  { eyebrow: "Vos activités", title: "Préparer le bon espace", description: "Choisissez un modèle puis gardez uniquement les disciplines réellement proposées." },
  { eyebrow: "Vos règles", title: "Décider avant l’accueil", description: "Définissez les cas de paiement et d’accès que votre équipe appliquera au quotidien." },
  { eyebrow: "Vérification", title: "Votre espace est prêt à démarrer", description: "Relisez les choix essentiels. Les données commerciales réelles seront ajoutées ensuite." },
] as const;

function initialStep(lastStepKey: string | null) {
  if (lastStepKey === "review") return 3;
  if (lastStepKey === "policies") return 2;
  if (lastStepKey === "activities") return 1;
  return 0;
}

export function OnboardingWizard({ initialState }: { initialState: TenantOnboardingState }) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [step, setStep] = useState(initialStep(initialState.lastStepKey));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = STEP_CONTENT[step];

  const editionLabel = useMemo(() => {
    if (state.profile === "CLASS_ONLY") return "Cours et planning";
    if (state.profile === "GYM_ONLY") return "Accès salle";
    return "Cours + accès salle";
  }, [state.profile]);

  async function mutate(input: OnboardingMutationInput) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await response.json().catch(() => ({})) as { data?: TenantOnboardingState; error?: string };
      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "La configuration n’a pas pu être enregistrée.");
      }
      setState(payload.data);
      return payload.data;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La configuration n’a pas pu être enregistrée.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndAdvance(input: OnboardingMutationInput, nextStep: number) {
    const result = await mutate(input);
    if (result) {
      setStep(nextStep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function complete() {
    const result = await mutate({ action: "COMPLETE" });
    if (!result) return;
    router.replace("/");
    router.refresh();
  }

  return (
    <section className="panel min-w-0 overflow-hidden">
      <div className="border-b border-[var(--border)] px-5 py-5 sm:px-7 sm:py-6">
        <OnboardingProgress current={step} />
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--primary)]">{heading.eyebrow}</p>
            <h1 className="mt-1.5 text-2xl font-extrabold sm:text-3xl">{heading.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">{heading.description}</p>
          </div>
          <span className="w-fit rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--primary)]">{editionLabel}</span>
        </div>
      </div>

      <div className="p-5 sm:p-7">
        <FeedbackMessage message={error} variant="error" className="mb-5" />
        {step === 0 ? (
          <OnboardingProfileStep state={state} saving={saving} onContinue={(input) => saveAndAdvance(input, 1)} />
        ) : step === 1 ? (
          <OnboardingActivitiesStep state={state} saving={saving} onBack={() => setStep(0)} onContinue={(input) => saveAndAdvance(input, 2)} />
        ) : step === 2 ? (
          <OnboardingPoliciesStep state={state} saving={saving} onBack={() => setStep(1)} onContinue={(input) => saveAndAdvance(input, 3)} />
        ) : (
          <OnboardingReviewStep state={state} saving={saving} onBack={() => setStep(2)} onEdit={setStep} onComplete={complete} />
        )}
      </div>
    </section>
  );
}
