import { AlertTriangle, ShieldCheck } from "lucide-react";

import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function SubscriptionCorrectionSummary({
  totalPaidCents,
  originalAmountCents,
  proposedAmountCents,
  originalRemainingSessions,
  proposedRemainingSessions,
  formulaChanged,
  statusChanged,
  needsAdjustmentReason,
  amountBelowPaid,
}: {
  totalPaidCents: number;
  originalAmountCents: number;
  proposedAmountCents: number;
  originalRemainingSessions: number;
  proposedRemainingSessions: number;
  formulaChanged: boolean;
  statusChanged: boolean;
  needsAdjustmentReason: boolean;
  amountBelowPaid: boolean;
}) {
  const amountChanged = proposedAmountCents !== originalAmountCents;
  const sessionsChanged = proposedRemainingSessions !== originalRemainingSessions;

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)]">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            amountBelowPaid
              ? "bg-[var(--danger)]/10 text-[var(--danger)]"
              : "bg-[var(--primary)]/10 text-[var(--primary)]",
          )}
        >
          {amountBelowPaid ? <AlertTriangle className="size-4" /> : <ShieldCheck className="size-4" />}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--foreground)]">Correction contrôlée</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
            L&apos;abonnement est corrigé avec un motif quand une valeur sensible change. Les paiements déjà
            encaissés restent conservés.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <SummaryMetric label="Déjà encaissé" value={formatMoney(totalPaidCents)} />
        <SummaryMetric
          label="Nouveau montant"
          value={formatMoney(proposedAmountCents)}
          tone={amountBelowPaid ? "danger" : amountChanged ? "warning" : "default"}
        />
        <SummaryMetric
          label="Séances"
          value={`${proposedRemainingSessions}`}
          detail={sessionsChanged ? `Avant: ${originalRemainingSessions}` : "Inchangé"}
          tone={sessionsChanged ? "warning" : "default"}
        />
        <SummaryMetric
          label="Motif"
          value={needsAdjustmentReason ? "Requis" : "Non requis"}
          tone={needsAdjustmentReason ? "warning" : "success"}
        />
      </div>

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <ChangePill active={formulaChanged} label="Formule modifiée" />
        <ChangePill active={statusChanged} label="Statut modifié" />
        <ChangePill active={amountChanged} label="Montant modifié" />
        <ChangePill active={sessionsChanged} label="Séances modifiées" />
      </div>

      {amountBelowPaid ? (
        <p className="mt-3 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/10 px-3 py-2 text-xs font-semibold leading-relaxed text-[var(--danger)]">
          Le montant ne peut pas être inférieur au total déjà encaissé.
        </p>
      ) : null}
    </section>
  );
}

function SummaryMetric({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        tone === "default" && "border-[var(--border)] bg-[var(--surface-soft)]",
        tone === "success" && "border-[var(--success)]/25 bg-[var(--success)]/10",
        tone === "warning" && "border-[var(--warning)]/25 bg-[var(--warning)]/10",
        tone === "danger" && "border-[var(--danger)]/25 bg-[var(--danger)]/10",
      )}
    >
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-[var(--foreground)]">{value}</p>
      {detail ? <p className="mt-0.5 text-[0.68rem] text-[var(--muted-foreground)]">{detail}</p> : null}
    </div>
  );
}

function ChangePill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 font-semibold",
        active
          ? "bg-[var(--warning)]/10 text-[var(--warning)]"
          : "bg-[var(--surface-soft)] text-[var(--muted-foreground)]",
      )}
    >
      {active ? "À tracer" : "Stable"} · {label}
    </span>
  );
}
