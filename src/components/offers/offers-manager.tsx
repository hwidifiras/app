"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";
import type { OfferLike } from "@/lib/offer-display";
import {
  formatOfferRulesSummary,
  getOfferKindLabel,
} from "@/lib/offer-display";
import type { OfferKind } from "@prisma/client";

type OfferRow = OfferLike;

type OfferKindValue = "PERCENT_OFF" | "FIXED_OFF" | "FAMILY_BUNDLE" | "SECOND_DISCIPLINE";

type OffersManagerProps = {
  sportsOptions: Array<{ id: string; name: string }>;
};

export function OffersManager({ sportsOptions }: OffersManagerProps) {
  const searchParams = useSearchParams();
  const contextMemberId = searchParams.get("memberId") ?? "";

  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<OfferKindValue>(
    (searchParams.get("kind") as OfferKindValue | null) ?? "PERCENT_OFF",
  );
  const [percentOff, setPercentOff] = useState("10");
  const [fixedAmountEur, setFixedAmountEur] = useState("");
  const [bundlePrice, setBundlePrice] = useState("");
  const [minMembers, setMinMembers] = useState("2");
  const [maxMembers, setMaxMembers] = useState("");
  const [sportId, setSportId] = useState("");
  const [requiresHousehold, setRequiresHousehold] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const contextHint = useMemo(() => {
    if (!contextMemberId) return null;
    return "Création contextualisée depuis la fiche élève — l'offre sera utilisable à l'inscription.";
  }, [contextMemberId]);

  function load() {
    fetch("/api/offers")
      .then((r) => r.json())
      .then((d) => setOffers(d.data ?? []));
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const payload: Record<string, unknown> = {
      name,
      kind,
      isActive: true,
    };

    if (kind === "PERCENT_OFF" || kind === "SECOND_DISCIPLINE") {
      payload.percentOff = parseInt(percentOff, 10);
      if (kind === "PERCENT_OFF" && maxMembers.trim()) {
        payload.maxMembers = parseInt(maxMembers, 10);
      }
    } else if (kind === "FIXED_OFF") {
      payload.amountOffCents = Math.round(parseFloat(fixedAmountEur.replace(",", ".")) * 100);
      if (maxMembers.trim()) {
        payload.maxMembers = parseInt(maxMembers, 10);
      }
    } else if (kind === "FAMILY_BUNDLE") {
      payload.minMembers = parseInt(minMembers, 10);
      payload.requiresHousehold = requiresHousehold;
      payload.bundlePriceCents = Math.round(parseFloat(bundlePrice.replace(",", ".")) * 100);
      if (sportId) {
        payload.sportId = sportId;
      }
    }

    const res = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Erreur");
      return;
    }
    setName("");
    setSportId("");
    setMessage("Offre créée — utilisable à l'inscription (étape Offre).");
    load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel p-5">
        <h2 className="mb-2 text-lg font-semibold">Créer une offre</h2>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          Configurez la règle par type — aucun JSON à saisir. Les offres s&apos;appliquent dans le parcours{" "}
          <strong>Inscription</strong>.
        </p>
        {contextHint ? (
          <p className="mb-4 rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-3 py-2 text-sm text-[var(--foreground)]">
            {contextHint}
          </p>
        ) : null}
        {message && (
          <FeedbackMessage
            variant={message.startsWith("Offre créée") ? "success" : "error"}
            message={message}
          />
        )}
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="field"
            placeholder="Nom de l'offre (ex. Famille 2 pers.)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <select
            className="field"
            value={kind}
            onChange={(e) => setKind(e.target.value as OfferKindValue)}
          >
            <option value="PERCENT_OFF">Réduction % sur le devis</option>
            <option value="FIXED_OFF">Montant fixe offert par ligne (€)</option>
            <option value="FAMILY_BUNDLE">Forfait famille (prix total)</option>
            <option value="SECOND_DISCIPLINE">Réduction 2e discipline (%)</option>
          </select>
          {(kind === "PERCENT_OFF" || kind === "SECOND_DISCIPLINE") && (
            <>
              <input
                className="field"
                placeholder="% de réduction"
                value={percentOff}
                onChange={(e) => setPercentOff(e.target.value)}
                required
              />
              {kind === "PERCENT_OFF" ? (
                <input
                  className="field"
                  placeholder="Nombre max. de lignes (optionnel)"
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(e.target.value)}
                />
              ) : null}
            </>
          )}
          {kind === "FIXED_OFF" && (
            <>
              <input
                className="field"
                placeholder="Montant offert par ligne (€)"
                value={fixedAmountEur}
                onChange={(e) => setFixedAmountEur(e.target.value)}
                required
              />
              <input
                className="field"
                placeholder="Nombre max. de lignes (optionnel)"
                value={maxMembers}
                onChange={(e) => setMaxMembers(e.target.value)}
              />
            </>
          )}
          {kind === "FAMILY_BUNDLE" && (
            <>
              <input
                className="field"
                placeholder="Prix total du forfait (€)"
                value={bundlePrice}
                onChange={(e) => setBundlePrice(e.target.value)}
                required
              />
              <input
                className="field"
                placeholder="Nombre min. d'inscriptions dans le devis"
                value={minMembers}
                onChange={(e) => setMinMembers(e.target.value)}
                required
              />
              <select className="field" value={sportId} onChange={(e) => setSportId(e.target.value)}>
                <option value="">Toutes les disciplines</option>
                {sportsOptions.map((sport) => (
                  <option key={sport.id} value={sport.id}>
                    {sport.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={requiresHousehold}
                  onChange={(e) => setRequiresHousehold(e.target.checked)}
                />
                Exiger le même foyer pour les élèves existants
              </label>
              <p className="text-xs text-[var(--muted-foreground)]">
                Deux nouveaux élèves dans le même devis sont acceptés ; le foyer sera créé automatiquement à la
                validation.
              </p>
            </>
          )}
          <FormActions sticky>
            <button type="submit" className="btn btn-primary btn-block-mobile min-h-11" disabled={loading}>
              {loading ? "Création…" : "Créer l'offre"}
            </button>
          </FormActions>
        </form>
      </section>
      <section className="panel p-5">
        <h2 className="mb-4 text-lg font-semibold">Offres actives</h2>
        <ul className="space-y-2 text-sm">
          {offers.map((o) => (
            <li key={o.id} className="rounded-xl border border-[var(--border)] p-3">
              <p className="font-medium text-[var(--foreground)]">{o.name}</p>
              <p className="text-xs font-semibold text-[var(--primary)]">
                {getOfferKindLabel(o.kind as OfferKind)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {formatOfferRulesSummary(o)}
              </p>
            </li>
          ))}
          {offers.length === 0 && (
            <p className="text-[var(--muted-foreground)]">Aucune offre active.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
