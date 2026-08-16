"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, CircleHelp, Loader2, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";

import { SignupAccountStep } from "@/components/signup/signup-account-step";
import { SignupClubStep } from "@/components/signup/signup-club-step";
import { SignupCompleteStep } from "@/components/signup/signup-complete-step";
import { SignupEditionStep } from "@/components/signup/signup-edition-step";
import { signupApi, SignupClientError } from "@/components/signup/signup-client";
import { SignupProgress, type SignupStep } from "@/components/signup/signup-progress";
import type {
  SignupClubDraft,
  SignupEdition,
  SignupPublicConfig,
  SignupState,
  WorkspaceHandoffPayload,
} from "@/components/signup/signup-types";
import { SignupVerifyStep } from "@/components/signup/signup-verify-step";
import { FeedbackMessage } from "@/components/ui/feedback-message";

const EMPTY_CLUB: SignupClubDraft = {
  clubName: "",
  clubPhone: "",
  clubAddress: "",
  slug: "",
};

type ProvisionedState = {
  handoff: WorkspaceHandoffPayload;
  trialEndsAt: string | null;
};

function stepFromSignup(signup: SignupState | null): SignupStep {
  if (!signup) return "account";
  if (signup.status === "PENDING_EMAIL") return "verify";
  if (signup.emailVerified) return "club";
  return "account";
}

function storageKey(signupId: string) {
  return `wd-signup-club:${signupId}`;
}

function readStoredClub(signupId: string): SignupClubDraft | null {
  try {
    const stored = window.sessionStorage.getItem(storageKey(signupId));
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<SignupClubDraft>;
    return {
      clubName: typeof parsed.clubName === "string" ? parsed.clubName : "",
      clubPhone: typeof parsed.clubPhone === "string" ? parsed.clubPhone : "",
      clubAddress: typeof parsed.clubAddress === "string" ? parsed.clubAddress : "",
      slug: typeof parsed.slug === "string" ? parsed.slug : "",
    };
  } catch {
    window.sessionStorage.removeItem(storageKey(signupId));
    return null;
  }
}

export function SignupWizard({
  config,
  inviteToken,
}: {
  config: SignupPublicConfig;
  inviteToken?: string;
}) {
  const [signup, setSignup] = useState<SignupState | null>(null);
  const [step, setStep] = useState<SignupStep>("account");
  const [club, setClub] = useState<SignupClubDraft>(EMPTY_CLUB);
  const [edition, setEdition] = useState<SignupEdition>("CLASS");
  const [templates, setTemplates] = useState<string[]>([]);
  const [developmentCode, setDevelopmentCode] = useState<string | null>(null);
  const [provisioned, setProvisioned] = useState<ProvisionedState | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    if (inviteToken) window.history.replaceState({}, "", "/signup");
  }, [inviteToken]);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const data = await signupApi<{ signup: SignupState }>("/api/saas-signup/state");
        if (cancelled) return;
        setSignup(data.signup);
        const storedClub = readStoredClub(data.signup.signupId);
        if (storedClub) setClub(storedClub);
        if (data.signup.status === "COMPLETED") {
          const resumed = await signupApi<{
            handoff: WorkspaceHandoffPayload;
            trialEndsAt: string;
          }>("/api/saas-signup/handoff", { method: "POST", body: JSON.stringify({}) });
          if (!cancelled) {
            setProvisioned({ handoff: resumed.handoff, trialEndsAt: resumed.trialEndsAt });
            setStep("edition");
          }
          return;
        }
        if (data.signup.status === "EXPIRED" || data.signup.status === "FAILED") {
          setStep("account");
          return;
        }
        setStep(stepFromSignup(data.signup));
      } catch (caught) {
        if (cancelled) return;
        if (!(caught instanceof SignupClientError) || caught.code !== "SIGNUP_SESSION_INVALID") {
          setRestoreError(caught instanceof Error ? caught.message : "Impossible de reprendre cette inscription.");
        }
      } finally {
        if (!cancelled) setRestoring(false);
      }
    }
    void restore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!signup?.signupId || !club.clubName) return;
    window.sessionStorage.setItem(storageKey(signup.signupId), JSON.stringify(club));
  }, [club, signup?.signupId]);

  const heading = useMemo(() => {
    if (provisioned) return { eyebrow: "Espace créé", title: "Bienvenue dans We Discipline", description: "La connexion à votre club est en cours." };
    if (step === "verify") return { eyebrow: "Sécurité du compte", title: "Confirmez votre email", description: "Une vérification rapide protège la création de votre espace." };
    if (step === "club") return { eyebrow: "Identité du club", title: "Créons votre espace", description: "Ces informations apparaîtront dans votre application et sur vos reçus." };
    if (step === "edition") return { eyebrow: "Configuration initiale", title: "Choisissez votre fonctionnement", description: "Activez seulement ce dont votre équipe a besoin aujourd'hui." };
    return { eyebrow: "Essai sans engagement", title: "Créez votre espace club", description: `${config.trialDays} jours pour configurer vos activités et tester vos parcours réels.` };
  }, [config.trialDays, provisioned, step]);

  if (restoring) {
    return (
      <div className="panel mx-auto flex min-h-80 max-w-xl items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="mx-auto size-6 animate-spin text-[#2563EB]" />
          <p className="mt-3 text-sm font-semibold text-[#52647A]">Préparation de votre inscription...</p>
        </div>
      </div>
    );
  }

  const cannotStart = !signup && (!config.enabled || (config.inviteOnly && !inviteToken));
  if (cannotStart) {
    return (
      <section className="panel mx-auto max-w-xl p-6 sm:p-8">
        <span className="flex size-11 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]"><LockKeyhole className="size-5" /></span>
        <p className="mt-5 text-xs font-bold uppercase text-[#2563EB]">Ouverture contrôlée</p>
        <h1 className="mt-2 text-2xl font-extrabold text-[#0B1220]">{config.enabled ? "Une invitation est nécessaire" : "La création d'espace arrive bientôt"}</h1>
        <p className="mt-3 text-sm leading-6 text-[#52647A]">
          {config.enabled
            ? "Utilisez le lien personnel reçu de notre équipe pour créer votre club."
            : "Les clubs existants restent accessibles normalement pendant la préparation de l'inscription en libre-service."}
        </p>
        <Link href="/find-workspace" className="btn btn-primary mt-6 w-full">Accéder à mon espace</Link>
      </section>
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <section className="panel min-w-0 overflow-hidden">
        <div className="border-b border-[#D8E2F0] px-5 py-5 sm:px-7 sm:py-6">
          {!provisioned ? <SignupProgress current={step} /> : null}
          <p className="mt-6 text-xs font-bold uppercase text-[#2563EB]">{heading.eyebrow}</p>
          <h1 className="mt-1.5 text-2xl font-extrabold text-[#0B1220] sm:text-3xl">{heading.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#52647A]">{heading.description}</p>
        </div>

        <div className="p-5 sm:p-7">
          <FeedbackMessage message={restoreError} variant="error" className="mb-4" />
          {provisioned ? (
            <SignupCompleteStep handoff={provisioned.handoff} trialEndsAt={provisioned.trialEndsAt} />
          ) : step === "account" ? (
            <SignupAccountStep
              config={config}
              inviteToken={inviteToken}
              onStarted={(state, code) => {
                setSignup(state);
                setDevelopmentCode(code ?? null);
                setStep(state.emailVerified ? "club" : "verify");
              }}
            />
          ) : step === "verify" && signup ? (
            <SignupVerifyStep signup={signup} developmentCode={developmentCode} onVerified={(state) => { setSignup(state); setStep("club"); }} />
          ) : step === "club" ? (
            <SignupClubStep
              configDomain={config.workspaceDomain}
              initialDraft={club}
              onContinue={(nextClub) => { setClub(nextClub); setStep("edition"); }}
            />
          ) : (
            <SignupEditionStep
              config={config}
              club={club}
              edition={edition}
              selectedTemplateKeys={templates}
              onEditionChange={setEdition}
              onTemplatesChange={setTemplates}
              onBack={() => setStep("club")}
              onProvisioned={({ handoff, trialEndsAt }) => {
                if (signup?.signupId) window.sessionStorage.removeItem(storageKey(signup.signupId));
                setProvisioned({ handoff, trialEndsAt });
              }}
            />
          )}
        </div>
      </section>

      <aside className="space-y-3 lg:sticky lg:top-6">
        <div className="rounded-lg border border-[#D8E2F0] bg-white p-4">
          <p className="text-xs font-bold uppercase text-[#64748B]">Ce qui est inclus</p>
          <ul className="mt-3 space-y-3 text-sm text-[#334155]">
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span>Données isolées dans votre propre espace</span></li>
            <li className="flex gap-2"><Sparkles className="mt-0.5 size-4 shrink-0 text-[#2563EB]" /><span>Parcours adapté à vos activités</span></li>
            <li className="flex gap-2"><CalendarCheck2 className="mt-0.5 size-4 shrink-0 text-[#2563EB]" /><span>Réglages modifiables à tout moment</span></li>
          </ul>
        </div>
        <div className="rounded-lg border border-[#D8E2F0] bg-[#F8FAFC] p-4 text-xs leading-5 text-[#64748B]">
          <p className="flex items-center gap-2 font-bold text-[#334155]"><CircleHelp className="size-4" />Déjà client ?</p>
          <p className="mt-1.5">Retrouvez l’adresse de votre club sans créer un second espace.</p>
          <Link href="/find-workspace" className="mt-2 inline-flex font-bold text-[#2563EB] hover:underline">Trouver mon espace</Link>
        </div>
      </aside>
    </div>
  );
}
