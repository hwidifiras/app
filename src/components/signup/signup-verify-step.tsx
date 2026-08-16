"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Loader2, MailCheck, RefreshCw } from "lucide-react";

import { signupApi, SignupClientError } from "@/components/signup/signup-client";
import type { SignupState } from "@/components/signup/signup-types";
import { FeedbackMessage } from "@/components/ui/feedback-message";

const RESEND_DELAY_SECONDS = 60;

export function SignupVerifyStep({
  signup,
  developmentCode,
  onVerified,
}: {
  signup: SignupState;
  developmentCode?: string | null;
  onVerified: (state: SignupState) => void;
}) {
  const [code, setCode] = useState(developmentCode ?? "");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resendWait, setResendWait] = useState(RESEND_DELAY_SECONDS);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setResendWait((current) => Math.max(0, current - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const data = await signupApi<{ signup: SignupState }>("/api/saas-signup/verify", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      onVerified(data.signup);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Le code n'a pas pu être vérifié.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    setMessage(null);
    try {
      const data = await signupApi<{
        ok: boolean;
        emailSent: boolean;
        emailWarning?: string;
        developmentVerification?: { code?: string };
      }>("/api/saas-signup/resend", { method: "POST", body: JSON.stringify({}) });
      if (data.developmentVerification?.code) setCode(data.developmentVerification.code);
      setMessage(data.emailSent
        ? "Un nouveau code vient d'être envoyé."
        : "Le nouveau code a été créé, mais l'email n'a pas pu être envoyé. Réessayez dans un instant.");
      setResendWait(RESEND_DELAY_SECONDS);
    } catch (caught) {
      const wait = caught instanceof SignupClientError ? caught.retryAfterSeconds : undefined;
      if (wait) setResendWait(wait);
      setError(caught instanceof Error ? caught.message : "Impossible de renvoyer le code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={verify} className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-[#2563EB] shadow-sm">
          <MailCheck className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-[#0B1220]">Consultez votre boîte email</p>
          <p className="mt-1 break-words text-sm leading-5 text-[#52647A]">
            Nous avons envoyé un code à <strong className="text-[#0B1220]">{signup.email}</strong>.
          </p>
        </div>
      </div>

      <FeedbackMessage message={error} variant="error" />
      <FeedbackMessage message={message} variant="success" />

      <div className="space-y-1.5">
        <label htmlFor="signup-code" className="text-sm font-semibold">Code à 6 chiffres</label>
        <input
          id="signup-code"
          className="field text-center font-mono text-xl font-bold tracking-[0.3em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          autoFocus
          required
          disabled={loading}
        />
        <p className="text-xs text-[#64748B]">Le code et le lien expirent après 30 minutes.</p>
      </div>

      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading || code.length !== 6}>
        {loading ? <><Loader2 className="size-4 animate-spin" />Vérification...</> : <>Confirmer mon email<ArrowRight className="size-4" /></>}
      </button>

      <button
        type="button"
        className="btn btn-ghost w-full"
        onClick={resend}
        disabled={resending || resendWait > 0}
      >
        <RefreshCw className={resending ? "size-4 animate-spin" : "size-4"} />
        {resendWait > 0 ? `Renvoyer dans ${resendWait}s` : "Renvoyer le code"}
      </button>
    </form>
  );
}
