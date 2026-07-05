import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { formatMoney } from "@/lib/money";
import type { DataImportPreview } from "./data-import-model";

type DataImportPreviewSummaryProps = {
  preview: DataImportPreview | null;
};

export function DataImportPreviewSummary({ preview }: DataImportPreviewSummaryProps) {
  if (!preview) return null;

  return (
    <section className="panel border-[var(--primary)]/30 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <h2 className="font-semibold">Prévalidation terminée</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {preview.memberName} · {preview.memberPhone}
          </p>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="text-[var(--muted-foreground)]">Discipline</span>
              <strong className="block">{preview.sportName}</strong>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)]">Groupe</span>
              <strong className="block">{preview.groupName}</strong>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)]">Formule</span>
              <strong className="block">{preview.planName}</strong>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)]">Solde financier</span>
              <strong className="block">{formatMoney(preview.remainingBalanceCents)}</strong>
            </div>
          </div>
          {preview.warnings.map((warning) => (
            <p key={warning} className="mt-3 flex gap-2 text-sm text-amber-700">
              <AlertTriangle className="size-4 shrink-0" />
              {warning}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
