"use client";

import { ArrowLeft, BadgeCheck, CalendarDays, Check, Dumbbell, Layers3, Loader2 } from "lucide-react";

import { signupApi } from "@/components/signup/signup-client";
import type {
  SignupActivityTemplate,
  SignupClubDraft,
  SignupEdition,
  SignupPublicConfig,
  WorkspaceHandoffPayload,
} from "@/components/signup/signup-types";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { cn } from "@/lib/utils";
import { useState } from "react";

const editions: Array<{
  value: SignupEdition;
  label: string;
  description: string;
  includes: string[];
  icon: typeof CalendarDays;
}> = [
  {
    value: "CLASS",
    label: "Cours & planning",
    description: "Pour un dojo, studio ou école avec des cours planifiés.",
    includes: ["Disciplines et coachs", "Groupes, planning et pointage"],
    icon: CalendarDays,
  },
  {
    value: "GYM",
    label: "Accès salle",
    description: "Pour une salle gérée par pass, quota ou accès illimité.",
    includes: ["Contrôle des accès", "QR, cartes et bracelets prêts à évoluer"],
    icon: Dumbbell,
  },
  {
    value: "HYBRID",
    label: "Cours + salle",
    description: "Pour réunir cours planifiés et accès libre dans un même club.",
    includes: ["Deux modules indépendants", "Formules mixtes et membre unifié"],
    icon: Layers3,
  },
];

function TemplateChoice({
  template,
  selected,
  onToggle,
}: {
  template: SignupActivityTemplate;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "flex min-h-24 w-full items-start gap-3 rounded-lg border p-3 text-left transition",
        selected
          ? "border-[#2563EB] bg-[#EFF6FF] shadow-sm"
          : "border-[#D8E2F0] bg-white hover:border-[#93C5FD] hover:bg-[#F8FAFC]",
      )}
    >
      <span className={cn(
        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border",
        selected ? "border-[#2563EB] bg-[#2563EB] text-white" : "border-[#CBD5E1] bg-white text-transparent",
      )}>
        <Check className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-[#0B1220]">{template.label}</span>
        <span className="mt-1 block text-xs leading-5 text-[#64748B]">{template.description}</span>
      </span>
    </button>
  );
}

export function SignupEditionStep({
  config,
  club,
  edition,
  selectedTemplateKeys,
  onEditionChange,
  onTemplatesChange,
  onBack,
  onProvisioned,
}: {
  config: SignupPublicConfig;
  club: SignupClubDraft;
  edition: SignupEdition;
  selectedTemplateKeys: string[];
  onEditionChange: (edition: SignupEdition) => void;
  onTemplatesChange: (keys: string[]) => void;
  onBack: () => void;
  onProvisioned: (payload: { handoff: WorkspaceHandoffPayload; trialEndsAt: string }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const compatibleTemplates = config.activityTemplates.filter((template) => template.editions.includes(edition));

  function chooseEdition(nextEdition: SignupEdition) {
    onEditionChange(nextEdition);
    onTemplatesChange(selectedTemplateKeys.filter((key) => {
      const template = config.activityTemplates.find((entry) => entry.key === key);
      return template?.editions.includes(nextEdition);
    }));
  }

  function toggleTemplate(key: string) {
    if (selectedTemplateKeys.includes(key)) {
      onTemplatesChange(selectedTemplateKeys.filter((entry) => entry !== key));
      return;
    }
    if (selectedTemplateKeys.length < 3) onTemplatesChange([...selectedTemplateKeys, key]);
  }

  async function provision() {
    setLoading(true);
    setError(null);
    try {
      const data = await signupApi<{
        tenantId: string;
        tenantSlug: string;
        trialEndsAt: string;
        handoff: WorkspaceHandoffPayload;
      }>("/api/saas-signup/provision", {
        method: "POST",
        body: JSON.stringify({
          clubName: club.clubName,
          clubPhone: club.clubPhone,
          clubAddress: club.clubAddress,
          slug: club.slug,
          edition,
          activityTemplateKeys: selectedTemplateKeys,
        }),
      });
      onProvisioned({ handoff: data.handoff, trialEndsAt: data.trialEndsAt });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de créer votre espace.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <FeedbackMessage message={error} variant="error" />

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-[#0B1220]">Comment fonctionne votre club ?</legend>
        <div className="grid gap-3 lg:grid-cols-3">
          {editions.map((option) => {
            const Icon = option.icon;
            const selected = edition === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => chooseEdition(option.value)}
                aria-pressed={selected}
                className={cn(
                  "relative min-h-52 rounded-lg border p-4 text-left transition",
                  selected
                    ? "border-[#2563EB] bg-[#EFF6FF] shadow-[0_8px_24px_rgba(37,99,235,0.10)]"
                    : "border-[#D8E2F0] bg-white hover:border-[#93C5FD]",
                )}
              >
                {selected ? <BadgeCheck className="absolute right-3 top-3 size-5 text-[#2563EB]" /> : null}
                <span className={cn("flex size-10 items-center justify-center rounded-lg", selected ? "bg-[#2563EB] text-white" : "bg-[#F1F5F9] text-[#475569]")}>
                  <Icon className="size-5" />
                </span>
                <span className="mt-4 block text-base font-bold text-[#0B1220]">{option.label}</span>
                <span className="mt-1.5 block text-sm leading-5 text-[#52647A]">{option.description}</span>
                <span className="mt-3 block space-y-1.5">
                  {option.includes.map((item) => (
                    <span key={item} className="flex items-start gap-1.5 text-xs font-medium text-[#475569]">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />{item}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <div>
          <legend className="text-sm font-bold text-[#0B1220]">Votre activité principale</legend>
          <p className="mt-1 text-xs leading-5 text-[#64748B]">Choisissez jusqu’à 3 modèles. Ils préparent les suggestions du démarrage et restent entièrement modifiables.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {compatibleTemplates.map((template) => (
            <TemplateChoice
              key={template.key}
              template={template}
              selected={selectedTemplateKeys.includes(template.key)}
              onToggle={() => toggleTemplate(template.key)}
            />
          ))}
        </div>
      </fieldset>

      <div className="rounded-lg border border-[#D8E2F0] bg-[#F8FAFC] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-[#2563EB]">Prêt à démarrer</p>
            <p className="mt-1 font-bold text-[#0B1220]">{club.clubName}</p>
            <p className="mt-1 text-xs text-[#64748B]">{club.slug}.{config.workspaceDomain} · Essai de {config.trialDays} jours</p>
          </div>
          <p className="max-w-sm text-xs leading-5 text-[#64748B]">Aucune donnée fictive ne sera ajoutée. Le guide vous aidera à valider chaque réglage avant d’accueillir vos membres.</p>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <button type="button" className="btn btn-ghost" onClick={onBack} disabled={loading}><ArrowLeft className="size-4" />Retour</button>
        <button type="button" className="btn btn-primary btn-lg" onClick={provision} disabled={loading}>
          {loading ? <><Loader2 className="size-4 animate-spin" />Création sécurisée...</> : <>Créer mon espace<BadgeCheck className="size-4" /></>}
        </button>
      </div>
    </div>
  );
}
