"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, ShieldAlert } from "lucide-react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { formatMoney } from "@/lib/money";
import type { EnrollmentRecoveryCandidate } from "@/lib/enrollment-recovery";

export function MemberEnrollmentRecoveryPanel({
  candidates,
}: {
  candidates: EnrollmentRecoveryCandidate[];
}) {
  const router = useRouter();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; variant?: "success" | "error" } | null>(null);

  async function voidEnrollment(candidate: EnrollmentRecoveryCandidate) {
    const reason = (reasons[candidate.recoveryKey] ?? "").trim();
    if (reason.length < 3) {
      setMessage({ text: "Motif obligatoire pour annuler une inscription.", variant: "error" });
      return;
    }

    setLoadingKey(candidate.recoveryKey);
    setMessage(null);

    const response = await fetch("/api/enrollment/revert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recoveryKey: candidate.recoveryKey, reason }),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string; data?: { voided?: boolean } } | null;
    setLoadingKey(null);

    if (!response.ok || !payload?.data?.voided) {
      setMessage({ text: payload?.error ?? "Impossible d'annuler cette inscription.", variant: "error" });
      return;
    }

    setReasons((current) => ({ ...current, [candidate.recoveryKey]: "" }));
    setMessage({ text: "Inscription annulée avec trace.", variant: "success" });
    router.refresh();
  }

  if (candidates.length === 0) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-soft)] px-3 py-3 text-xs leading-relaxed text-[var(--muted-foreground)]">
        Aucune inscription récente annulable depuis cette fiche. Utilisez les corrections par élément si une activité a
        déjà commencé.
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {message ? <FeedbackMessage message={message.text} variant={message.variant} /> : null}
      {candidates.map((candidate) => {
        const reason = reasons[candidate.recoveryKey] ?? "";
        const blocked = Boolean(candidate.blockedReason);
        return (
          <div key={candidate.recoveryKey} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-panel)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted-foreground)]">
                  Inscription du {new Date(candidate.createdAt).toLocaleDateString("fr-FR")}
                </p>
                <p className="mt-1 truncate text-sm font-bold text-[var(--foreground)]">{candidate.summary}</p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  {candidate.subscriptionIds.length} abonnement(s)
                  {candidate.totalFinalCents !== null ? ` · ${formatMoney(candidate.totalFinalCents)}` : ""}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-semibold ${
                  blocked ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {blocked ? "Bloquée" : "Annulable"}
              </span>
            </div>

            {candidate.blockedReason ? (
              <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                <p>{candidate.blockedReason}</p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <label htmlFor={`enrollment-recovery-${candidate.recoveryKey}`} className="text-xs font-semibold text-[var(--foreground)]">
                  Motif d&apos;annulation
                </label>
                <input
                  id={`enrollment-recovery-${candidate.recoveryKey}`}
                  className="field min-h-10 text-sm"
                  value={reason}
                  onChange={(event) =>
                    setReasons((current) => ({ ...current, [candidate.recoveryKey]: event.target.value }))
                  }
                  placeholder="Ex. mauvais groupe, doublon, erreur montant"
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-block-mobile inline-flex items-center justify-center gap-1.5 border-[var(--danger)]/30 text-[var(--danger)]"
                  disabled={loadingKey === candidate.recoveryKey || reason.trim().length < 3}
                  onClick={() => { void voidEnrollment(candidate); }}
                >
                  <RotateCcw className="size-4" />
                  {loadingKey === candidate.recoveryKey ? "Annulation..." : "Annuler avec trace"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
