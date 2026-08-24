import { Upload } from "lucide-react";

import { BulkImportPreviewTable, type BulkImportResult } from "@/components/settings/data-import-bulk-ui";
import { DemoMutationButton } from "@/components/ui/demo-read-only";

type DataImportBulkSectionProps = {
  templateUrl: string;
  bulkBusy: boolean;
  bulkFile: File | null;
  bulkPreview: BulkImportResult | null;
  onFileChange: (file: File | null) => void;
  onPreview: () => void;
  onApply: () => void;
};

export function DataImportBulkSection({
  templateUrl,
  bulkBusy,
  bulkFile,
  bulkPreview,
  onFileChange,
  onPreview,
  onApply,
}: DataImportBulkSectionProps) {
  return (
    <section className="panel p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">Import Excel</p>
          <h2 className="mt-1 text-lg font-semibold">Reprise Excel simplifiée</h2>
          <p className="mt-1 max-w-3xl text-sm text-[var(--muted-foreground)]">
            Utilisez le modèle avec la situation actuelle des membres: groupe, formule, validité, séances restantes et paiement déjà reçu.
          </p>
          <p className="mt-2 max-w-3xl rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800">
            Une seule date est demandée dans l&apos;écran: la date de reprise. Le fichier ne doit pas inventer de date d&apos;inscription ou de début de groupe.
          </p>
        </div>
        <a href={templateUrl} className="btn btn-ghost btn-block-mobile" download>
          Télécharger le modèle
        </a>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <label className="text-sm font-medium">
          Fichier .xlsx ou .csv
          <input
            type="file"
            accept=".xlsx,.csv"
            className="field mt-1"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
        </label>
        <DemoMutationButton type="button" disabled={bulkBusy || !bulkFile} onClick={onPreview} className="btn btn-ghost btn-block-mobile">
          Vérifier Excel
        </DemoMutationButton>
        <DemoMutationButton
          type="button"
          disabled={bulkBusy || !bulkPreview || bulkPreview.errorRows > 0 || bulkPreview.okRows === 0}
          onClick={onApply}
          className="btn btn-primary btn-block-mobile"
        >
          <Upload className="size-4" /> Importer {bulkPreview?.okRows ? `(${bulkPreview.okRows})` : ""}
        </DemoMutationButton>
      </div>

      {bulkPreview ? <BulkImportPreviewTable result={bulkPreview} /> : null}
    </section>
  );
}
