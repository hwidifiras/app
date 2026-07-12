"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

type VisitRow = {
  id: string;
  entryType: "CHECK_IN" | "REVERSAL";
  checkedAt: string;
  unitsDelta: number;
  overrideReason: string | null;
  correctionReason: string | null;
  memberName: string;
  memberPhone: string;
  planName: string;
  checkedByName: string;
  reversed: boolean;
};

export function GymVisitsList({ visits }: { visits: VisitRow[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reverseVisit() {
    if (!selectedId || reason.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/gym/visits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId: selectedId, reason: reason.trim() }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error || "Correction impossible");
      setSelectedId(null);
      setReason("");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Correction impossible");
    } finally {
      setBusy(false);
    }
  }

  if (visits.length === 0) {
    return <div className="panel panel-soft p-8 text-center text-sm text-[var(--muted-foreground)]">Aucun passage enregistré.</div>;
  }

  return (
    <div className="panel overflow-hidden">
      {error ? <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <div className="divide-y divide-[var(--border)]">
        {visits.map((visit) => {
          const isCorrection = visit.entryType === "REVERSAL";
          const canReverse = !isCorrection && !visit.reversed;
          return (
            <article key={visit.id} className="p-4 transition-colors hover:bg-[var(--surface-soft)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-[var(--foreground)]">{visit.memberName}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[0.68rem] font-bold ${isCorrection || visit.reversed ? "bg-slate-100 text-slate-600" : visit.overrideReason ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                      {isCorrection ? "Correction" : visit.reversed ? "Annulé" : visit.overrideReason ? "Exceptionnel" : "Admis"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">{visit.planName} · {visit.memberPhone}</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(visit.checkedAt))} · {visit.checkedByName}
                  </p>
                  {visit.overrideReason || visit.correctionReason ? (
                    <p className="mt-2 text-xs text-[var(--foreground)]">Motif : {visit.overrideReason ?? visit.correctionReason}</p>
                  ) : null}
                </div>
                {canReverse ? (
                  <button type="button" className="btn btn-ghost shrink-0" onClick={() => { setSelectedId(visit.id); setReason(""); setError(null); }}>
                    <RotateCcw className="size-4" /> Corriger
                  </button>
                ) : null}
              </div>

              {selectedId === visit.id ? (
                <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                  <label htmlFor={`reversal-${visit.id}`} className="text-xs font-semibold">Pourquoi annuler ce passage ?</label>
                  <textarea id={`reversal-${visit.id}`} className="input mt-2 min-h-20 w-full resize-y py-2" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex. double saisie par erreur" />
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" className="btn btn-ghost" onClick={() => setSelectedId(null)}>Fermer</button>
                    <button type="button" className="btn btn-primary" disabled={reason.trim().length < 3 || busy} onClick={() => void reverseVisit()}>{busy ? "Correction..." : "Confirmer"}</button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
