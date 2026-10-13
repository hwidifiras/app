"use client";

import { useEffect, useState } from "react";

type Result = { ok?: boolean; canceled?: boolean; error?: string };
type Status = { originalAvailable: boolean; passwordRequired: boolean; firstLaunch: boolean };
declare global {
  interface Window {
    weDisciplineDesktop?: {
      status(): Promise<Status>;
      backup(): Promise<Result>;
      restoreFile(): Promise<Result>;
      restoreOriginal(password?: string): Promise<Result>;
    };
  }
}

export function OfflineRecovery({ initial = false }: { initial?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void window.weDisciplineDesktop?.status().then((data) => { if (active) setStatus(data); }).catch(() => { if (active) setMessage("Impossible de lire l'archive locale."); });
    return () => { active = false; };
  }, []);
  async function run(action: "backup" | "restoreFile" | "restoreOriginal") {
    if (!window.weDisciplineDesktop || busy) return;
    setBusy(true); setMessage(null);
    try {
      const result = action === "restoreOriginal" ? await window.weDisciplineDesktop.restoreOriginal(password) : await window.weDisciplineDesktop[action]();
      setPassword("");
      if (result.error) setMessage(result.error);
      else if (result.ok) setMessage(action === "backup" ? "Sauvegarde terminée." : "Données restaurées. Reconnectez-vous.");
    } catch { setMessage("Opération interrompue. Consultez le menu Données et récupération."); }
    finally { setBusy(false); }
  }
  return <section className="panel space-y-4 p-5" aria-label="Récupération des données">
    <h2 className="text-lg font-semibold">{initial ? "Retrouver les données du client" : "Sauvegarde et récupération"}</h2>
    <p className="text-sm text-[var(--muted-foreground)]">L&apos;archive originale inclut les membres, groupes, formules, séances, paiements, reçus et le logo du club. Chaque restauration conserve automatiquement une copie de sécurité de la situation actuelle.</p>
    {status ? <>
      {status.originalAvailable ? <div className="space-y-3 rounded-lg border border-[var(--border)] p-4">
        <p className="font-semibold">Données originales du client — archive incluse</p>
        {status.passwordRequired ? <label className="block text-sm">Mot de passe de récupération<input className="field mt-1 block w-full" type="password" autoComplete="off" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} /><span className="mt-1 block text-xs text-[var(--muted-foreground)]">Utilisez le mot de passe local fourni pour cette édition. Après la première restauration, Windows protège l&apos;accès pour permettre la récupération en un clic sur cet ordinateur.</span></label> : <p className="text-sm">Récupération en un clic disponible sur cet ordinateur.</p>}
        <button className="btn btn-primary" disabled={busy || (status.passwordRequired && !password)} onClick={() => void run("restoreOriginal")}>{busy ? "Opération en cours…" : "Restaurer les données originales"}</button>
      </div> : <p className="text-sm">Cette installation ne contient pas d&apos;archive originale.</p>}
      {!status.firstLaunch ? <div className="flex flex-wrap gap-3"><button className="btn btn-ghost" disabled={busy} onClick={() => void run("backup")}>Sauvegarder mes données</button><button className="btn btn-ghost" disabled={busy} onClick={() => void run("restoreFile")}>Restaurer une sauvegarde</button></div> : null}
    </> : <p className="text-sm text-[var(--muted-foreground)]">La récupération est disponible dans l&apos;application Windows We Discipline.</p>}
    {message ? <p role="status" className="text-sm">{message}</p> : null}
  </section>;
}
