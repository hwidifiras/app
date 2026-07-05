"use client";

import Link from "next/link";

import { FormField } from "@/components/ui/form-layout";

type EnrollmentCompletionPanelProps = {
  memberIds: string[];
  voidReason: string;
  voiding: boolean;
  onVoidReasonChange: (value: string) => void;
  onVoid: () => void;
};

export function EnrollmentCompletionPanel({
  memberIds,
  voidReason,
  voiding,
  onVoidReasonChange,
  onVoid,
}: EnrollmentCompletionPanelProps) {
  const firstMemberHref = memberIds[0] ? `/members/${memberIds[0]}` : "/members";

  return (
    <section className="rounded-lg border border-[var(--success)]/35 bg-[var(--success)]/10 p-4 shadow-[var(--shadow-panel)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--success)]">
            Inscription enregistree
          </p>
          <h2 className="mt-1 text-base font-black text-[var(--foreground)]">
            Verification avant de quitter
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
            Si une erreur humaine vient d&apos;etre faite, vous pouvez annuler cette inscription tant qu&apos;aucun pointage
            n&apos;a ete cree sur les abonnements ou les eleves concernes. L&apos;annulation reste tracee dans le journal.
          </p>
        </div>
        <Link
          href={firstMemberHref}
          className="btn btn-primary btn-block-mobile shrink-0"
          prefetch={false}
        >
          Voir fiche
        </Link>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <FormField
          label="Motif d'annulation"
          htmlFor="enrollmentVoidReason"
          hint="Ex. mauvais groupe, mauvais montant, doublon de fiche."
        >
          <input
            id="enrollmentVoidReason"
            className="field"
            value={voidReason}
            onChange={(event) => onVoidReasonChange(event.target.value)}
            placeholder="Motif obligatoire"
          />
        </FormField>
        <button
          type="button"
          className="btn btn-ghost btn-block-mobile border-[var(--danger)]/30 text-[var(--danger)]"
          disabled={voiding || voidReason.trim().length < 3}
          onClick={onVoid}
        >
          {voiding ? "Annulation..." : "Annuler cette inscription"}
        </button>
      </div>
    </section>
  );
}
