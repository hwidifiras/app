import { formatDateFr } from "@/components/sessions/session-planner-ui";

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
  return (
    <div className="mt-4 rounded-lg border border-[var(--primary)]/25 bg-[var(--primary)]/5 p-4 shadow-[var(--shadow-panel)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
            Aperçu de génération
          </p>
          <h3 className="mt-1 text-base font-black text-[var(--foreground)]">
            {preview.createdCount > 0
              ? `${preview.createdCount} séance${preview.createdCount > 1 ? "s" : ""} manquante${preview.createdCount > 1 ? "s" : ""} à créer`
              : "Aucune séance manquante à créer"}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
            Cette action crée uniquement les séances manquantes à partir des horaires hebdomadaires actifs.
            Cible: {targetLabel}. Période du {formatDateFr(preview.startDate)} au {formatDateFr(preview.endDate)}.
            Les séances déjà existantes seront ignorées.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[20rem]">
          <GenerationMetric label="Horaires actifs" value={preview.activeScheduleCount} />
          <GenerationMetric label="Déjà existantes" value={preview.skippedCount} />
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
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
            ? "Création..."
            : `Générer ${preview.createdCount} séance${preview.createdCount > 1 ? "s" : ""} manquante${preview.createdCount > 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}

function GenerationMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-[var(--foreground)]">{value}</p>
    </div>
  );
}
