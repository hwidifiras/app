"use client";

import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Dumbbell,
  GraduationCap,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import type { TenantOnboardingState } from "@/components/onboarding/onboarding-types";
import { CLUB_DAY_SHORT_LABELS } from "@/lib/club-working-days";

const PROFILE_LABELS = {
  CLASS_ONLY: "Cours et planning",
  GYM_ONLY: "Accès salle",
  HYBRID: "Cours + accès salle",
} as const;

function ReadinessStep({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof GraduationCap;
  title: string;
  description: string;
}) {
  return (
    <li className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--info-surface)] text-[var(--primary)]">
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-[var(--muted-foreground)]">{description}</span>
      </span>
    </li>
  );
}

export function OnboardingReviewStep({
  state,
  saving,
  onBack,
  onEdit,
  onComplete,
}: {
  state: TenantOnboardingState;
  saving: boolean;
  onBack: () => void;
  onEdit: (step: 0 | 1 | 2) => void;
  onComplete: () => Promise<void>;
}) {
  const hasClasses = state.modules.includes("CLASS_MANAGEMENT");
  const hasGym = state.modules.includes("GYM_ACCESS");
  const selectedTemplates = state.templates.filter((template) => state.selectedTemplateKeys.includes(template.key));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-[var(--muted-foreground)]">Espace</p>
              <h2 className="mt-1 text-base font-extrabold">{state.club.name}</h2>
            </div>
            <button type="button" className="text-xs font-bold text-[var(--primary)] hover:underline" onClick={() => onEdit(0)}>Modifier</button>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-[var(--muted-foreground)]">Édition</dt><dd className="text-right font-semibold">{PROFILE_LABELS[state.profile]}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--muted-foreground)]">Ouverture</dt><dd className="text-right font-semibold">{state.club.workingDays.map((day) => CLUB_DAY_SHORT_LABELS[day]).join(" · ")}</dd></div>
          </dl>
        </section>

        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-[var(--muted-foreground)]">Activités</p>
              <h2 className="mt-1 text-base font-extrabold">{selectedTemplates.length > 0 ? selectedTemplates.map((template) => template.label).join(", ") : "Configuration libre"}</h2>
            </div>
            <button type="button" className="text-xs font-bold text-[var(--primary)] hover:underline" onClick={() => onEdit(1)}>Modifier</button>
          </div>
          {hasClasses ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {state.selectedDisciplineNames.map((name) => <span key={name} className="rounded-md bg-[var(--surface-soft)] px-2 py-1 text-xs font-semibold">{name}</span>)}
            </div>
          ) : <p className="mt-3 text-xs leading-5 text-[var(--muted-foreground)]">Aucune discipline requise pour gérer les pass et les accès.</p>}
        </section>
      </div>

      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-[var(--muted-foreground)]">Règles d’accueil</p>
            <h2 className="mt-1 text-base font-extrabold">Décisions visibles et modifiables</h2>
          </div>
          <button type="button" className="text-xs font-bold text-[var(--primary)] hover:underline" onClick={() => onEdit(2)}>Modifier</button>
        </div>
        <ul className="mt-3 grid gap-2 text-xs leading-5 text-[var(--muted-foreground)] sm:grid-cols-2">
          {hasClasses ? <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span>Paiement partiel au pointage : <strong className="text-[var(--foreground)]">{state.policies.allowCheckInWithPartialPayment ? "autorisé" : "bloqué"}</strong></span></li> : null}
          {hasClasses ? <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span>Absence : <strong className="text-[var(--foreground)]">{state.policies.absentConsumesSession ? "séance consommée" : "aucune séance consommée"}</strong></span></li> : null}
          {hasGym ? <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span>Paiement partiel en salle : <strong className="text-[var(--foreground)]">{state.policies.gymAllowCheckInWithPartialPayment ? "autorisé" : "bloqué"}</strong></span></li> : null}
          {hasGym ? <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span>Passage exceptionnel : <strong className="text-[var(--foreground)]">{state.policies.gymAllowExceptionalAccess ? "avec motif obligatoire" : "désactivé"}</strong></span></li> : null}
        </ul>
      </section>

      <section>
        <p className="text-sm font-bold">Après cette étape</p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">Votre espace reste propre : aucun membre, paiement, abonnement ou planning fictif n’est ajouté.</p>
        <ol className="mt-3 grid gap-2 sm:grid-cols-3">
          {hasClasses ? <ReadinessStep icon={GraduationCap} title="Organiser les cours" description="Ajoutez les coachs, groupes et horaires réels du club." /> : null}
          {hasGym ? <ReadinessStep icon={Dumbbell} title="Créer les pass" description="Définissez un accès illimité, un quota ou un pack combiné." /> : null}
          <ReadinessStep icon={CreditCard} title="Tester une vente" description="Créez un membre réel, encaissez et vérifiez son reçu." />
        </ol>
      </section>

      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
        <div>
          <p className="text-sm font-bold">Configuration réversible</p>
          <p className="mt-1 text-xs leading-5">Ces réglages restent modifiables dans le club. Les futures cartes QR, codes-barres, NFC/RFID et bracelets utiliseront les mêmes droits d’accès, sans recréer les abonnements.</p>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:justify-between">
        <button type="button" className="btn btn-ghost" onClick={onBack} disabled={saving}><ArrowLeft className="size-4" />Retour</button>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => void onComplete()} disabled={saving}>
          {saving ? <><Loader2 className="size-4 animate-spin" />Finalisation...</> : <><CheckCircle2 className="size-4" />Ouvrir mon espace</>}
        </button>
      </div>
    </div>
  );
}
