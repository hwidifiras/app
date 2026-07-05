import { formatMoney } from "@/lib/money";

export type BulkImportRow = {
  rowNumber: number;
  externalId: string;
  memberName: string;
  groupName: string;
  planName: string;
  status: "OK" | "ERROR" | "IMPORTED";
  errors: string[];
  warnings: string[];
  memberId?: string;
  remainingBalanceCents?: number;
};

export type BulkImportResult = {
  totalRows: number;
  okRows: number;
  errorRows: number;
  importedRows: number;
  rows: BulkImportRow[];
};

function bulkRowStatusText(row: BulkImportRow) {
  if (row.status === "ERROR") return row.errors.join("; ");
  if (row.status === "IMPORTED") return "Importé";
  return row.warnings.join("; ") || "Valide";
}

function bulkRowStatusClass(row: BulkImportRow) {
  if (row.status === "ERROR") return "text-red-700";
  if (row.status === "IMPORTED") return "text-blue-700";
  return "text-emerald-700";
}

export function BulkImportPreviewTable({ result }: { result: BulkImportResult }) {
  return (
    <div className="mt-5 space-y-3">
      <div className="grid gap-2 text-sm sm:grid-cols-4">
        <BulkImportMetric label="Lignes" value={result.totalRows} className="bg-[var(--surface-soft)] text-[var(--foreground)]" />
        <BulkImportMetric label="Valides" value={result.okRows} className="bg-emerald-500/10 text-emerald-700" />
        <BulkImportMetric label="Erreurs" value={result.errorRows} className="bg-red-500/10 text-red-700" />
        <BulkImportMetric label="Importées" value={result.importedRows} className="bg-blue-500/10 text-blue-700" />
      </div>

      <div className="data-table overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[var(--surface-soft)] text-xs uppercase text-[var(--muted-foreground)]">
            <tr>
              <th className="px-3 py-2">Ligne</th>
              <th className="px-3 py-2">Membre</th>
              <th className="px-3 py-2">Groupe</th>
              <th className="px-3 py-2">Formule</th>
              <th className="px-3 py-2">Solde</th>
              <th className="px-3 py-2">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {result.rows.slice(0, 50).map((row) => (
              <tr key={`${row.rowNumber}-${row.externalId}`}>
                <td className="px-3 py-2" data-label="Ligne">{row.rowNumber}</td>
                <td className="data-table-primary px-3 py-2 font-medium" data-label="Membre">
                  <span>{row.memberName || "Membre sans nom"}</span>
                  {row.externalId ? (
                    <span className="mt-0.5 block text-[0.68rem] font-medium text-[var(--muted-foreground)]">
                      Réf. générée {row.externalId}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2" data-label="Groupe">{row.groupName || "-"}</td>
                <td className="px-3 py-2" data-label="Formule">{row.planName || "-"}</td>
                <td className="px-3 py-2" data-label="Solde">{formatMoney(row.remainingBalanceCents ?? 0)}</td>
                <td className="px-3 py-2" data-label="Statut">
                  <span className={bulkRowStatusClass(row)}>
                    {bulkRowStatusText(row)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BulkImportMetric({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={`rounded-lg p-3 ${className}`}>
      <span>{label}</span>
      <strong className="block">{value}</strong>
    </div>
  );
}
