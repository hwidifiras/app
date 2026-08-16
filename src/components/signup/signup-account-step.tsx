"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Eye, EyeOff, Loader2, LockKeyhole, Mail, UserRound } from "lucide-react";

import { SignupAntiBotField, executeSignupRecaptcha } from "@/components/signup/signup-anti-bot-field";
import { signupApi } from "@/components/signup/signup-client";
import type { SignupPublicConfig, SignupState } from "@/components/signup/signup-types";
import { FeedbackMessage } from "@/components/ui/feedback-message";

export function SignupAccountStep({
  config,
  inviteToken,
  onStarted,
}: {
  config: SignupPublicConfig;
  inviteToken?: string;
  onStarted: (state: SignupState, developmentCode?: string | null) => void;
}) {
  const idempotencyKey = useRef(crypto.randomUUID());
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [antiBotToken, setAntiBotToken] = useState<string | null>(null);
  const [antiBotResetKey, setAntiBotResetKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAntiBotToken = useCallback((token: string | null) => setAntiBotToken(token), []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let securityToken = antiBotToken ?? undefined;
      if (config.antiBot.provider === "RECAPTCHA") {
        if (!config.antiBot.siteKey) throw new Error("La vérification de sécurité est indisponible.");
        securityToken = await executeSignupRecaptcha(config.antiBot.siteKey);
      }
      const data = await signupApi<{
        signup: SignupState;
        emailSent: boolean | null;
        developmentVerification?: { code: string; url: string };
      }>("/api/saas-signup/start", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey.current },
        body: JSON.stringify({
          ownerName,
          email,
          password,
          termsAccepted,
          inviteToken: inviteToken || undefined,
          antiBotToken: securityToken,
        }),
      });
      onStarted(data.signup, data.developmentVerification?.code);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible de démarrer l'inscription.");
      if (config.antiBot.provider === "TURNSTILE") {
        setAntiBotToken(null);
        setAntiBotResetKey((value) => value + 1);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FeedbackMessage message={error} variant="error" />

      <div className="space-y-1.5">
        <label htmlFor="signup-owner" className="text-sm font-semibold">Votre nom</label>
        <div className="field-control">
          <UserRound className="field-control-icon" />
          <input id="signup-owner" className="field has-leading-icon" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} autoComplete="name" placeholder="Firas Ben Ali" minLength={2} maxLength={100} required disabled={loading} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="signup-email" className="text-sm font-semibold">Email professionnel</label>
        <div className="field-control">
          <Mail className="field-control-icon" />
          <input id="signup-email" className="field has-leading-icon" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="direction@monclub.tn" maxLength={254} required disabled={loading} />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="signup-password" className="text-sm font-semibold">Mot de passe</label>
        <div className="field-control">
          <LockKeyhole className="field-control-icon" />
          <input id="signup-password" className="field has-leading-icon has-trailing-action" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="10 caractères minimum" minLength={10} maxLength={128} required disabled={loading} />
          <button type="button" className="field-control-action" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <p className="text-xs text-[#64748B]">Au moins 10 caractères, avec une lettre et un chiffre.</p>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#D8E2F0] bg-[#F8FAFC] p-3 text-sm leading-5">
        <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-1 size-4 shrink-0 accent-[#2563EB]" required disabled={loading} />
        <span>
          J’accepte les{" "}
          {config.legal.termsUrl ? <Link href={config.legal.termsUrl} target="_blank" className="font-semibold text-[#2563EB] hover:underline">conditions d’utilisation</Link> : "conditions d’utilisation"}
          {" "}et la{" "}
          {config.legal.privacyUrl ? <Link href={config.legal.privacyUrl} target="_blank" className="font-semibold text-[#2563EB] hover:underline">politique de confidentialité</Link> : "politique de confidentialité"}.
        </span>
      </label>

      <SignupAntiBotField provider={config.antiBot.provider} siteKey={config.antiBot.siteKey} resetKey={antiBotResetKey} onToken={handleAntiBotToken} />

      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading || !termsAccepted || (config.antiBot.provider === "TURNSTILE" && !antiBotToken)}>
        {loading ? <><Loader2 className="size-4 animate-spin" />Création en cours...</> : <>Continuer<ArrowRight className="size-4" /></>}
      </button>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-[#64748B]">
        <Building2 className="size-3.5" />
        Un espace séparé et sécurisé sera créé pour votre club.
      </p>
    </form>
  );
}
