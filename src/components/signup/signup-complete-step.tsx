"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

import type { WorkspaceHandoffPayload } from "@/components/signup/signup-types";

export function SignupCompleteStep({
  handoff,
  trialEndsAt,
}: {
  handoff: WorkspaceHandoffPayload;
  trialEndsAt?: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => formRef.current?.requestSubmit(), 500);
    return () => window.clearTimeout(timer);
  }, []);

  const trialLabel = trialEndsAt
    ? new Intl.DateTimeFormat("fr-TN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(trialEndsAt))
    : null;

  return (
    <div className="space-y-6 text-center">
      <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <CheckCircle2 className="size-9" />
      </span>
      <div>
        <h2 className="text-2xl font-extrabold text-[#0B1220]">Votre espace est prêt</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#52647A]">
          Nous vous connectons à votre club pour terminer les réglages essentiels.
          {trialLabel ? ` Votre essai est actif jusqu'au ${trialLabel}.` : ""}
        </p>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#1E3A8A]">
        <ShieldCheck className="size-4" />
        Connexion sécurisée à votre espace
      </div>

      <form ref={formRef} method="post" action={handoff.actionUrl} className="space-y-3">
        <input type="hidden" name="userId" value={handoff.userId} />
        <input type="hidden" name="token" value={handoff.token} />
        <button type="submit" className="btn btn-primary btn-lg w-full">
          <Loader2 className="size-4 animate-spin" />
          Ouvrir mon espace
          <ArrowRight className="size-4" />
        </button>
      </form>

      <p className="text-xs text-[#64748B]">Cette autorisation est temporaire et ne peut être utilisée qu’une fois.</p>
    </div>
  );
}
