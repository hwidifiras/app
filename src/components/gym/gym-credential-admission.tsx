"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, ShieldAlert, XCircle } from "lucide-react";

import { GymCameraScanner } from "@/components/gym/gym-camera-scanner";
import type { GymAccessDecisionDto } from "@/components/gym/gym-types";
import { formatMoney } from "@/lib/money";

export function GymCredentialAdmission({ onAccessRecorded }: { onAccessRecorded?: () => void }) {
  const [codeInput, setCodeInput] = useState("");
  const [lastCredentialCode, setLastCredentialCode] = useState<string | null>(null);
  const [decision, setDecision] = useState<GymAccessDecisionDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  async function submitCredential(rawCode: string, exceptional = false) {
    const credentialCode = rawCode.trim();
    if (!credentialCode || busy) return;
    setBusy(true);
    setDecision(null);
    try {
      const response = await fetch("/api/gym/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentialCode,
          ...(exceptional ? { overrideReason: overrideReason.trim() } : {}),
        }),
      });
      const json = (await response.json()) as {
        data?: GymAccessDecisionDto | { access?: GymAccessDecisionDto };
        error?: string;
        code?: string;
      };
      let result: GymAccessDecisionDto | null = null;
      if (json.data) {
        result = "access" in json.data
          ? json.data.access ?? null
          : json.data as GymAccessDecisionDto;
      }
      setDecision(result ?? {
        allowed: false,
        override: false,
        code: json.code ?? "ACCESS_FAILED",
        message: json.error || "Passage non enregistré",
        member: null,
        entitlement: null,
      });
      setLastCredentialCode(credentialCode);
      setCodeInput("");
      if (response.ok) {
        setOverrideOpen(false);
        setOverrideReason("");
        onAccessRecorded?.();
      }
    } catch (error) {
      setDecision({
        allowed: false,
        override: false,
        code: "NETWORK_ERROR",
        message: error instanceof Error ? error.message : "Passage non enregistré",
        member: null,
        entitlement: null,
      });
    } finally {
      setBusy(false);
    }
  }

  const debt = Math.max(0, (decision?.entitlement?.amount ?? 0) - (decision?.entitlement?.totalPaid ?? 0));
  const canOverride = Boolean(
    !decision?.allowed
    && decision?.member
    && decision.entitlement
    && !["MEMBER_ARCHIVED", "NO_GYM_PASS", "CREDENTIAL_INVALID", "CREDENTIAL_REVOKED"].includes(decision.code ?? ""),
  );

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-[var(--border)] p-4">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--primary)]">Accès rapide</p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Scanner une carte membre</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Lecteur USB : scannez puis appuyez sur Entrée. Sur téléphone, utilisez la caméra.</p>
      </div>
      <form className="p-4" onSubmit={(event) => { event.preventDefault(); void submitCredential(codeInput); }}>
        <label htmlFor="gym-credential-code" className="sr-only">Code de la carte</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <CreditCard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              id="gym-credential-code"
              className="field h-11 w-full pl-9 font-mono"
              value={codeInput}
              onChange={(event) => setCodeInput(event.target.value)}
              placeholder="Scanner la carte..."
              autoComplete="off"
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary h-11 sm:min-w-28" disabled={busy || codeInput.trim().length < 20}>
            {busy ? "Contrôle..." : "Valider"}
          </button>
          <GymCameraScanner disabled={busy} onScan={(value) => void submitCredential(value)} />
        </div>
      </form>

      {decision ? (
        <div className={`border-t p-4 ${decision.allowed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`} role="status">
          <div className="flex items-start gap-3">
            {decision.allowed ? <CheckCircle2 className="mt-0.5 size-7 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 size-7 shrink-0 text-red-600" />}
            <div className="min-w-0 flex-1">
              <p className={`text-base font-bold ${decision.allowed ? "text-emerald-900" : "text-red-900"}`}>
                {decision.allowed ? "Entrée enregistrée" : "Accès refusé"}
              </p>
              <p className={`mt-1 text-sm ${decision.allowed ? "text-emerald-800" : "text-red-800"}`}>{decision.message}</p>
              {decision.member ? (
                <p className="mt-2 font-semibold text-[#0B1220]">{decision.member.firstName} {decision.member.lastName}</p>
              ) : null}
              {decision.entitlement ? (
                <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
                  <span><strong className="block text-[#0B1220]">{decision.entitlement.planName}</strong>Formule</span>
                  <span><strong className="block text-[#0B1220]">{decision.entitlement.accessMode === "UNLIMITED" ? "Illimité" : `${decision.entitlement.remainingUnits ?? 0} visite(s)`}</strong>Droits avant passage</span>
                  <span><strong className={`block ${debt > 0 ? "text-amber-700" : "text-emerald-700"}`}>{formatMoney(debt)}</strong>Solde</span>
                </div>
              ) : null}

              {canOverride && lastCredentialCode ? (
                overrideOpen ? (
                  <div className="mt-3 max-w-xl">
                    <label htmlFor="credential-override-reason" className="text-xs font-semibold text-red-900">Motif exceptionnel obligatoire</label>
                    <textarea id="credential-override-reason" className="field mt-2 min-h-20 w-full resize-y bg-white py-2" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Ex. accord ponctuel du responsable" />
                    <div className="mt-2 flex gap-2">
                      <button type="button" className="btn btn-ghost flex-1" onClick={() => setOverrideOpen(false)}>Annuler</button>
                      <button type="button" className="btn btn-primary flex-1" disabled={busy || overrideReason.trim().length < 3} onClick={() => void submitCredential(lastCredentialCode, true)}>Autoriser l&apos;entrée</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm mt-3" onClick={() => setOverrideOpen(true)}><ShieldAlert className="size-4" /> Passage exceptionnel</button>
                )
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
