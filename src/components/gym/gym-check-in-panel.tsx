"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, Dumbbell, Search, ShieldAlert, XCircle } from "lucide-react";

import { GymCredentialAdmission } from "@/components/gym/gym-credential-admission";
import type { GymAccessDecisionDto as AccessDecision } from "@/components/gym/gym-types";
import { formatMoney } from "@/lib/money";

export function GymCheckInPanel({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<AccessDecision[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [overrideMemberId, setOverrideMemberId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function loadMembers(searchQuery: string) {
    const normalized = searchQuery.trim();
    if (normalized.length < 2) {
      setResults([]);
      setMessage({ tone: "error", text: "Saisissez au moins 2 caractères." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/gym/check-in?query=${encodeURIComponent(normalized)}`, { cache: "no-store" });
      const json = (await response.json()) as { data?: AccessDecision[]; error?: string };
      if (!response.ok) throw new Error(json.error || "Recherche impossible");
      setResults(json.data ?? []);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Recherche impossible" });
    } finally {
      setLoading(false);
    }
  }

  async function searchMembers(event?: React.FormEvent) {
    event?.preventDefault();
    await loadMembers(query);
  }

  async function checkIn(decision: AccessDecision, exceptional = false) {
    if (!decision.member) return;
    setSubmittingId(decision.member.id);
    setMessage(null);
    try {
      const response = await fetch("/api/gym/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: decision.member.id,
          ...(exceptional ? { overrideReason: overrideReason.trim() } : {}),
        }),
      });
      const json = (await response.json()) as { error?: string; data?: { access?: AccessDecision } };
      if (!response.ok) throw new Error(json.error || "Passage non enregistré");
      setMessage({
        tone: "success",
        text: `${decision.member.firstName} ${decision.member.lastName} — entrée enregistrée.`,
      });
      setOverrideMemberId(null);
      setOverrideReason("");
      await searchMembers();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Passage non enregistré" });
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <GymCredentialAdmission onAccessRecorded={() => { if (query.trim().length >= 2) void searchMembers(); }} />

      <form onSubmit={searchMembers} className="panel p-3 sm:p-4">
        <label htmlFor="gym-member-search" className="mb-2 block text-sm font-semibold text-[var(--foreground)]">
          Rechercher manuellement un membre
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
            <input
              id="gym-member-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="field h-11 w-full pl-9"
              placeholder="Nom ou téléphone"
              autoComplete="off"
            />
          </div>
          <button type="submit" className="btn btn-primary h-11 sm:min-w-32" disabled={loading}>
            {loading ? "Recherche..." : "Rechercher"}
          </button>
        </div>
      </form>

      {message ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm font-medium ${
            message.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
          role="status"
        >
          {message.text}
        </div>
      ) : null}

      {!loading && query.trim().length >= 2 && results.length === 0 ? (
        <section className="panel panel-soft p-8 text-center">
          <Search className="mx-auto size-8 text-[var(--muted-foreground)]" />
          <h2 className="mt-3 font-semibold">Aucun membre trouvé</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Vérifiez le nom ou le numéro de téléphone.</p>
        </section>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {results.map((decision) => {
          if (!decision.member) return null;
          const debt = Math.max(0, (decision.entitlement?.amount ?? 0) - (decision.entitlement?.totalPaid ?? 0));
          const canOverride = Boolean(decision.entitlement && decision.code !== "MEMBER_ARCHIVED" && decision.code !== "NO_GYM_PASS");
          const overrideOpen = overrideMemberId === decision.member.id;
          return (
            <article key={decision.member.id} className="panel overflow-hidden">
              <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] p-4">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-bold text-[var(--foreground)]">
                    {decision.member.firstName} {decision.member.lastName}
                  </h2>
                  <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{decision.member.phone}</p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${decision.allowed ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>
                  {decision.allowed ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                  {decision.allowed ? "Autorisé" : "Refusé"}
                </span>
              </div>

              <div className="space-y-3 p-4">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Dumbbell className="size-4 text-[var(--primary)]" />
                    {decision.entitlement?.planName ?? "Aucun pass salle"}
                  </div>
                  {decision.entitlement ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                      <div><span className="block text-[var(--muted-foreground)]">Accès</span><strong>{decision.entitlement.accessMode === "UNLIMITED" ? "Illimité" : `${decision.entitlement.remainingUnits ?? 0} visite(s)`}</strong></div>
                      <div><span className="block text-[var(--muted-foreground)]">Échéance</span><strong>{decision.entitlement.endDate ? new Intl.DateTimeFormat("fr-FR").format(new Date(decision.entitlement.endDate)) : "Sans fin"}</strong></div>
                      <div><span className="block text-[var(--muted-foreground)]">Solde</span><strong className={debt > 0 ? "text-amber-700" : "text-emerald-700"}>{formatMoney(debt)}</strong></div>
                    </div>
                  ) : null}
                </div>

                <p className={`flex items-start gap-2 text-sm ${decision.allowed ? "text-emerald-700" : "text-red-700"}`}>
                  {decision.allowed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <ShieldAlert className="mt-0.5 size-4 shrink-0" />}
                  {decision.message}
                </p>

                {decision.allowed ? (
                  <button className="btn btn-primary w-full" disabled={submittingId === decision.member.id} onClick={() => void checkIn(decision)}>
                    <Clock3 className="size-4" /> {submittingId === decision.member.id ? "Enregistrement..." : "Enregistrer l'entrée"}
                  </button>
                ) : canOverride ? (
                  overrideOpen ? (
                    <div className="space-y-2">
                      <label className="text-xs font-semibold" htmlFor={`gym-reason-${decision.member.id}`}>Motif obligatoire</label>
                      <textarea id={`gym-reason-${decision.member.id}`} value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} className="field min-h-20 w-full resize-y py-2" placeholder="Ex. validation exceptionnelle du responsable" />
                      <div className="flex gap-2">
                        <button type="button" className="btn btn-ghost flex-1" onClick={() => setOverrideMemberId(null)}>Annuler</button>
                        <button type="button" className="btn btn-primary flex-1" disabled={overrideReason.trim().length < 3 || submittingId === decision.member.id} onClick={() => void checkIn(decision, true)}>Autoriser</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="btn btn-ghost w-full" onClick={() => { setOverrideMemberId(decision.member!.id); setOverrideReason(""); }}>Passage exceptionnel</button>
                  )
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

    </div>
  );
}
