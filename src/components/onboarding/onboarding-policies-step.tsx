"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, CreditCard, Loader2, QrCode, ShieldCheck } from "lucide-react";

import type { OnboardingPoliciesInput, TenantOnboardingState } from "@/components/onboarding/onboarding-types";

function PolicyToggle({
  checked,
  onChange,
  title,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  title: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <span><span className="block text-sm font-bold">{title}</span><span className="mt-1 block text-xs leading-5 text-[var(--muted-foreground)]">{description}</span></span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-[var(--primary)] peer-focus-visible:ring-3 peer-focus-visible:ring-[var(--focus-ring-soft)]" />
        <span className="absolute left-1 top-1 size-4 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function OnboardingPoliciesStep({
  state,
  saving,
  onBack,
  onContinue,
}: {
  state: TenantOnboardingState;
  saving: boolean;
  onBack: () => void;
  onContinue: (input: OnboardingPoliciesInput) => Promise<void>;
}) {
  const hasClasses = state.modules.includes("CLASS_MANAGEMENT");
  const hasGym = state.modules.includes("GYM_ACCESS");
  const [classPartial, setClassPartial] = useState(state.policies.allowCheckInWithPartialPayment);
  const [absenceConsumes, setAbsenceConsumes] = useState(state.policies.absentConsumesSession);
  const [gymPartial, setGymPartial] = useState(state.policies.gymAllowCheckInWithPartialPayment);
  const [gymExceptional, setGymExceptional] = useState(state.policies.gymAllowExceptionalAccess);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await onContinue({
      action: "POLICIES",
      allowCheckInWithPartialPayment: classPartial,
      absentConsumesSession: absenceConsumes,
      gymAllowCheckInWithPartialPayment: gymPartial,
      gymAllowExceptionalAccess: gymExceptional,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {hasClasses ? (
        <fieldset>
          <legend className="flex items-center gap-2 text-sm font-bold"><CreditCard className="size-4 text-[var(--primary)]" />Pointage des cours</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <PolicyToggle checked={classPartial} onChange={setClassPartial} title="Autoriser un paiement partiel" description="Un membre ayant commencé à payer peut être pointé normalement. Une dette reste visible à l'accueil." />
            <PolicyToggle checked={absenceConsumes} onChange={setAbsenceConsumes} title="Une absence consomme la séance" description="À la finalisation, une absence planifiée retire une séance. Désactivez pour ne compter que les présences." />
          </div>
        </fieldset>
      ) : null}

      {hasGym ? (
        <fieldset className={hasClasses ? "border-t border-[var(--border)] pt-5" : ""}>
          <legend className="flex items-center gap-2 text-sm font-bold"><QrCode className="size-4 text-[var(--primary)]" />Accès salle</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <PolicyToggle checked={gymPartial} onChange={setGymPartial} title="Autoriser un paiement partiel" description="Le pass reste utilisable après un premier versement tant que sa période et son quota sont valides." />
            <PolicyToggle checked={gymExceptional} onChange={setGymExceptional} title="Permettre un passage exceptionnel" description="Le personnel peut autoriser un accès bloqué uniquement avec un motif conservé dans le journal." />
          </div>
          <div className="mt-3 flex items-start gap-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-4 text-[#1E3A8A]">
            <ShieldCheck className="mt-0.5 size-5 shrink-0" />
            <div><p className="text-sm font-bold">Supports d’accès évolutifs</p><p className="mt-1 text-xs leading-5">La recherche manuelle et le QR sont prêts. Les codes-barres, cartes NFC/RFID et bracelets utilisent le même registre révocable et pourront être activés sans changer les abonnements.</p></div>
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:justify-between">
        <button type="button" className="btn btn-ghost" onClick={onBack} disabled={saving}><ArrowLeft className="size-4" />Retour</button>
        <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>{saving ? <><Loader2 className="size-4 animate-spin" />Enregistrement...</> : <>Vérifier ma configuration<ArrowRight className="size-4" /></>}</button>
      </div>
    </form>
  );
}
