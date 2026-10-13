"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/money";
import type { StudentImportOptions } from "@/lib/student-excel-import";

type Plan = { id: string; name: string; planKind: "CLASS" | "GYM" | "MIXED"; price: number; sportId: string | null; totalSessions: number; activationPolicy: string; validityDays: number; entitlements: { type: string; sportId: string | null; grantedUnits: number | null; gymAccessMode: string | null; sport: { name: string } | null }[] };
type Catalog = { importActive: boolean; modules: string[]; plans: Plan[]; groups: { id: string; name: string; sportId: string; groupType: string; genderPolicy: string; capacity: number; _count: { members: number } }[] };
type Preview = { totalRows: number; readyRows: number; errorRows: number; importedRows: number; previewToken?: string | null; rows: { rowNumber: number; firstName: string; lastName: string; planName: string; errors: string[]; warnings: string[]; amountCents: number | null; paidCents: number | null; balanceCents: number | null; groupNames: string[]; activation: string; activationPolicy: string | null; startDate: string | null; endDate: string | null; gymMode: string | null; gymRemaining: number | null; classBalances: { sportId: string; sportName: string; remaining: number }[] }[] };

export function StudentExcelImport({ initialKind = "CLASS" }: { initialKind?: StudentImportOptions["kind"] }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [options, setOptions] = useState<StudentImportOptions>({ kind: initialKind, cutoverDate: new Date().toISOString().slice(0, 10), defaultPlanId: "", groupIds: [] });
  const [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void fetch("/api/data-import/students").then(async (response) => { const json = await response.json(); if (active) { if (response.ok) setCatalog(json.data); else setError(json.error); } }).catch(() => { if (active) setError("Catalogue indisponible."); });
    return () => { active = false; };
  }, []);
  function change(next: StudentImportOptions) { setOptions(next); setPreview(null); setError(null); }
  async function activate() {
    setBusy(true); setError(null);
    try { const response = await fetch("/api/data-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "activate" }) }); const json = await response.json(); if (!response.ok) throw new Error(json.error); setCatalog((previous) => previous ? { ...previous, importActive: true } : previous); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Activation impossible."); }
    finally { setBusy(false); }
  }
  async function enableModule(moduleKey: string) {
    if (!window.confirm("Activer ce module sur cet ordinateur ? Vous pourrez créer ses formules et importer ses élèves. L'archive originale restera inchangée.")) return;
    setBusy(true); setError(null); setPreview(null);
    try {
      const response = await fetch("/api/offline/modules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ moduleKey }) });
      const json = await response.json(); if (!response.ok) throw new Error(json.error);
      const updated = await fetch("/api/data-import/students"); const fresh = await updated.json(); if (!updated.ok) throw new Error(fresh.error); setCatalog(fresh.data); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Activation impossible."); }
    finally { setBusy(false); }
  }
  async function submit(action: "preview" | "apply") {
    if (!file || busy || (action === "apply" && !preview?.previewToken)) return;
    if (action === "apply" && !window.confirm(`Importer ${preview!.readyRows} élèves et leurs abonnements ? Aucun membre existant ne sera remplacé.`)) return;
    setBusy(true); setError(null);
    const body = new FormData(); body.set("file", file); body.set("action", action); body.set("options", JSON.stringify(options)); if (preview?.previewToken) body.set("previewToken", preview.previewToken);
    try {
      const response = await fetch("/api/data-import/students", { method: "POST", body }); const json = await response.json();
      if (!response.ok || !json.data) throw new Error(json.error || "Import impossible.");
      setPreview(json.data);
      if (action === "apply") router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Import impossible."); setPreview(null); }
    finally { setBusy(false); }
  }
  const plans = catalog?.plans.filter((plan) => plan.planKind === options.kind) ?? [];
  const plan = plans.find((item) => item.id === options.defaultPlanId);
  const sportIds = plan ? plan.entitlements.filter((right) => right.type === "CLASS_SESSIONS").map((right) => right.sportId) : [];
  if (plan?.planKind === "CLASS" && !sportIds.length) sportIds.push(plan.sportId);
  const groups = catalog?.groups.filter((group) => sportIds.includes(group.sportId)) ?? [];
  const allowed = catalog && (options.kind === "GYM" || catalog.modules.includes("CLASS_MANAGEMENT")) && (options.kind === "CLASS" || catalog.modules.includes("GYM_ACCESS"));
  return <section className="panel space-y-4 p-5" aria-label="Import Excel des élèves">
    <h2 className="text-lg font-semibold">Importer des élèves depuis Excel</h2>
    <p className="text-sm text-[var(--muted-foreground)]">Une ligne par élève. Reprenez les abonnements et soldes existants : aucun supplément automatique, aucune fusion avec les membres déjà présents. Maximum 200 élèves et 5 Mo par fichier.</p>
    <fieldset disabled={busy} className="grid gap-4 md:grid-cols-3">
      <label className="text-sm">Activité à importer<select className="field mt-1 block w-full" value={options.kind} onChange={(event) => change({ ...options, kind: event.target.value as StudentImportOptions["kind"], defaultPlanId: "", groupIds: [] })}><option value="CLASS">Arts martiaux / cours</option><option value="GYM">Salle de sport</option><option value="MIXED">Mixte : cours et salle</option></select></label>
      <label className="text-sm">Formule par défaut<select className="field mt-1 block w-full" value={options.defaultPlanId} onChange={(event) => change({ ...options, defaultPlanId: event.target.value, groupIds: [] })}><option value="">Choisir par ligne dans le fichier</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
      <label className="text-sm">Date de reprise<input className="field mt-1 block w-full" type="date" value={options.cutoverDate} onChange={(event) => change({ ...options, cutoverDate: event.target.value })} /></label>
      {groups.length ? <div className="space-y-2 md:col-span-3"><p className="text-sm font-semibold">Groupes par défaut — un par discipline</p>{groups.map((group) => <label key={group.id} className="mr-4 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={options.groupIds.includes(group.id)} onChange={(event) => change({ ...options, groupIds: event.target.checked ? [...options.groupIds.filter((id) => catalog!.groups.find((other) => other.id === id)?.sportId !== group.sportId), group.id] : options.groupIds.filter((id) => id !== group.id) })} />{group.name} · {Math.max(0, group.capacity - group._count.members)} places</label>)}</div> : null}
    </fieldset>
    {plan ? <div className="rounded-lg bg-[var(--surface-soft)] p-3 text-sm"><p className="font-semibold">{plan.name} · {formatMoney(plan.price)} · {plan.validityDays} jours</p><p>{plan.activationPolicy === "FIRST_USE" ? "Activation à la première entrée : ATTENTE ou reprise ACTIF avec date fin." : "Activation à date fixe."}</p>{plan.entitlements.map((right, index) => <p key={index}>{right.type === "CLASS_SESSIONS" ? `${right.sport?.name} : ${right.grantedUnits} séances ; saisir le solde restant.` : right.gymAccessMode === "UNLIMITED" ? "Salle : accès illimité, visites restantes à laisser vide." : `Salle : ${right.grantedUnits} visites ; saisir le quota restant.`}</p>)}</div> : null}
    {!allowed && catalog ? <div className="space-y-2"><p role="alert" className="text-sm text-amber-700">Le module choisi n&apos;est pas actif pour ce club. La configuration originale est conservée.</p>{process.env.NEXT_PUBLIC_OFFLINE === "1" ? <button className="btn btn-ghost" disabled={busy} onClick={() => void enableModule(options.kind !== "GYM" && !catalog.modules.includes("CLASS_MANAGEMENT") ? "CLASS_MANAGEMENT" : "GYM_ACCESS")}>Activer ce module sur cet ordinateur</button> : null}</div> : null}
    <a className="btn btn-ghost" href={`/api/data-import/students?template=1&options=${encodeURIComponent(JSON.stringify(options))}`}>Télécharger le modèle Excel adapté</a>
    {!catalog?.importActive && catalog ? <div className="flex flex-wrap items-center gap-3"><button className="btn btn-ghost" disabled={busy} onClick={() => void activate()}>Activer la reprise Excel</button><p className="text-xs">Session administrateur temporaire de 4 heures.</p></div> : null}
    <label className="block text-sm">Fichier Excel des élèves<input className="field mt-1 block w-full" type="file" accept=".xlsx,.csv" disabled={busy} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); setError(null); }} /></label>
    <div className="flex flex-wrap gap-3"><button className="btn btn-ghost" disabled={busy || !file || !allowed || !catalog?.importActive} onClick={() => void submit("preview")}>Vérifier le fichier Excel</button><button className="btn btn-primary" disabled={busy || !preview?.previewToken || Boolean(preview.errorRows) || Boolean(preview.importedRows)} onClick={() => void submit("apply")}>{busy ? "Opération en cours…" : `Importer ${preview?.readyRows ?? 0} élèves`}</button></div>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    {preview ? <div aria-live="polite" className="space-y-3"><p className="font-semibold">{preview.importedRows ? `${preview.importedRows} élèves importés avec succès.` : `${preview.readyRows}/${preview.totalRows} lignes prêtes · ${preview.errorRows} à corriger. Aucun élève ajouté pendant la vérification.`}</p>{preview.rows.map((row) => <article key={row.rowNumber} className="rounded-lg border border-[var(--border)] p-3 text-sm"><p className="font-semibold">Ligne {row.rowNumber} · {row.firstName} {row.lastName} · {row.planName}</p>{row.errors.length ? <p className="text-red-700">{row.errors.join(" · ")}</p> : <><p>{row.groupNames.join(" / ") || "Accès salle"} · {row.activation} · {row.startDate} → {row.endDate ?? "À la première entrée"}</p><p>Total {formatMoney(row.amountCents ?? 0)} · payé {formatMoney(row.paidCents ?? 0)} · solde {formatMoney(row.balanceCents ?? 0)}</p><p>{row.classBalances.map((balance) => `${balance.sportName} : ${balance.remaining} séances`).join(" · ")}{row.gymMode === "UNLIMITED" ? " · Salle illimitée" : row.gymRemaining !== null ? ` · ${row.gymRemaining} visites restantes` : ""}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{row.warnings.join(" · ")}</p></>}</article>)}</div> : null}
  </section>;
}
