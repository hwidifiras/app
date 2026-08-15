"use client";

import { useState } from "react";
import { Download, FileCheck2, Upload } from "lucide-react";

import { formatMoney } from "@/lib/money";

type ImportRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  phone: string;
  planName: string;
  paidCents: number | null;
  memberAction: "EXISTING" | "CREATE";
  status: "READY" | "ERROR";
  errors: string[];
  warnings: string[];
};

type Preview = {
  totalRows: number;
  readyRows: number;
  errorRows: number;
  rows: ImportRow[];
  dryRun: true;
};

export function GymImportPreview() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function inspect(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    const body = new FormData();
    body.append("file", file);
    try {
      const response = await fetch("/api/gym/import", { method: "POST", body });
      const json = (await response.json()) as { data?: Preview; error?: string };
      if (!response.ok || !json.data) throw new Error(json.error || "Analyse impossible");
      setPreview(json.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Analyse impossible");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const content = "\uFEFFPrénom;Nom;Téléphone;Email;Formule;Date début;Montant payé\r\nAmine;Ben Salah;22111222;amine@example.com;Salle illimitée;;60,00\r\n";
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "modele-import-salle.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <section className="panel p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">1. Préparer le fichier</h2>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted-foreground)]">Une ligne par membre et pass salle. Les noms de formule doivent correspondre exactement au catalogue actif.</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={downloadTemplate}><Download className="size-4" /> Modèle CSV</button>
        </div>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={inspect}>
          <label className="min-w-0 flex-1 text-xs font-semibold text-[var(--foreground)]">Fichier .xlsx ou .csv<input type="file" accept=".xlsx,.csv" className="field mt-1 block w-full py-2" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
          <button type="submit" className="btn btn-primary" disabled={!file || busy}><Upload className="size-4" /> {busy ? "Analyse..." : "Vérifier le fichier"}</button>
        </form>
        <p className="mt-3 text-xs font-medium text-amber-700">Prévisualisation uniquement : aucune donnée ne sera créée ou modifiée.</p>
        {error ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p> : null}
      </section>

      {preview ? (
        <section className="panel overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[var(--primary)]">Contrôle terminé</p><h2 className="mt-1 text-base font-semibold">{preview.readyRows}/{preview.totalRows} lignes prêtes</h2></div>
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${preview.errorRows ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}><FileCheck2 className="size-4" />{preview.errorRows ? `${preview.errorRows} à corriger` : "Fichier valide"}</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {preview.rows.map((row) => (
              <article key={row.rowNumber} className="grid gap-2 p-4 sm:grid-cols-[3rem_minmax(0,1.2fr)_minmax(0,1fr)_8rem] sm:items-start">
                <span className="text-xs text-[var(--muted-foreground)]">Ligne {row.rowNumber}</span>
                <div><p className="font-semibold">{row.firstName} {row.lastName}</p><p className="text-xs text-[var(--muted-foreground)]">{row.phone} · {row.memberAction === "EXISTING" ? "Membre existant" : "Nouveau membre"}</p></div>
                <div><p className="text-sm font-medium">{row.planName || "Formule manquante"}</p><p className="text-xs text-[var(--muted-foreground)]">Payé : {row.paidCents === null ? "-" : formatMoney(row.paidCents)}</p></div>
                <span className={`justify-self-start rounded-full px-2 py-1 text-xs font-bold ${row.status === "READY" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{row.status === "READY" ? "Prêt" : "Erreur"}</span>
                {row.errors.length || row.warnings.length ? <div className="sm:col-start-2 sm:col-span-3"><p className="text-xs text-red-700">{row.errors.join(" · ")}</p><p className="mt-1 text-xs text-amber-700">{row.warnings.join(" · ")}</p></div> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
