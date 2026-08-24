"use client";

import { useId, useRef } from "react";
import { X } from "lucide-react";

import { formatDateFr } from "@/components/sessions/session-planner-derived-model";
import { useAccessibleDialog } from "@/hooks/use-accessible-dialog";

export type SessionGenerationPreview = {
  horizonDays: number;
  dryRun: boolean;
  groupId: string | null;
  startDate: string;
  endDate: string;
  groupCount: number;
  activeScheduleCount: number;
  candidatesCount: number;
  createdCount: number;
  skippedCount: number;
};

export function SessionGenerationPanel({
  preview,
  targetLabel,
  generating,
  onCancel,
  onGenerate,
}: {
  preview: SessionGenerationPreview;
  targetLabel: string;
  generating: boolean;
  onCancel: () => void;
  onGenerate: () => void;
}) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useAccessibleDialog<HTMLDivElement>({
    open: true,
    onClose: onCancel,
    initialFocusRef: closeButtonRef,
  });

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-[var(--overlay)] sm:items-center sm:p-4" onClick={onCancel} role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-floating)] sm:max-w-2xl sm:rounded-xl sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
              Aperçu de génération
            </p>
            <h2 id={titleId} className="mt-1 text-lg font-black text-[var(--foreground)]">
              {preview.createdCount > 0
                ? `${preview.createdCount} séance${preview.createdCount > 1 ? "s" : ""} manquante${preview.createdCount > 1 ? "s" : ""} à créer`
                : "Aucune séance manquante à créer"}
            </h2>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onCancel} className="btn btn-ghost min-h-11 min-w-11 p-2" aria-label="Fermer l’aperçu">
            <X className="size-5" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
          Cette action crée uniquement les séances manquantes à partir des horaires hebdomadaires actifs.
          Cible : {targetLabel}. Période du {formatDateFr(preview.startDate)} au {formatDateFr(preview.endDate)}.
          Les séances déjà existantes seront ignorées.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <GenerationMetric label="Horaires actifs" value={preview.activeScheduleCount} />
          <GenerationMetric label="Déjà existantes" value={preview.skippedCount} />
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:justify-end">
          <button type="button" className="btn btn-ghost btn-block-mobile" onClick={onCancel}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-primary btn-block-mobile"
            disabled={generating || preview.createdCount === 0}
            onClick={onGenerate}
          >
            {generating
              ? "Création…"
              : `Générer ${preview.createdCount} séance${preview.createdCount > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function GenerationMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-[var(--foreground)]">{value}</p>
    </div>
  );
}
