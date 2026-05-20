"use client";

import { FormEvent, useEffect, useState } from "react";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import type { OfferLike } from "@/lib/offer-display";
import {
  formatOfferRulesSummary,
  getOfferKindLabel,
} from "@/lib/offer-display";
import type { OfferKind } from "@prisma/client";

type OfferRow = {
  id: string;
  name: string;
  kind: string;
  isActive: boolean;
  rules: Record<string, unknown>;
};

export function OffersManager() {
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"PERCENT_OFF" | "FIXED_OFF" | "FAMILY_BUNDLE" | "SECOND_DISCIPLINE">(
    "PERCENT_OFF",
  );
  const [percentOff, setPercentOff] = useState("10");
  const [bundlePrice, setBundlePrice] = useState("");
  const [minMembers, setMinMembers] = useState("2");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

    let rules: Record<string, unknown> = {};
    if (kind === "PERCENT_OFF" || kind === "SECOND_DISCIPLINE") {
      rules = { percentOff: parseInt(percentOff, 10) };
    } else if (kind === "FIXED_OFF") {
      rules = { amountOffCents: Math.round(parseFloat(percentOff.replace(",", ".")) * 100) };
    } else if (kind === "FAMILY_BUNDLE") {
      rules = {
        minMembers: parseInt(minMembers, 10),
        requiresHousehold: true,
        bundlePriceCents: Math.round(parseFloat(bundlePrice.replace(",", ".")) * 100),
      };
    }

    const res = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, kind, rules }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Erreur");
      return;
    }
    setName("");
    setMessage("Offre créée — utilisable à l'inscription (étape Offre).");
    load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel p-5">
        <h2 className="mb-2 text-lg font-semibold">Créer une offre</h2>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          Les offres s&apos;appliquent uniquement dans le parcours <strong>Inscription</strong>, au moment du devis.
        </p>
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
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="PERCENT_OFF">Réduction % sur le devis</option>
            <option value="FIXED_OFF">Montant fixe offert par ligne (€)</option>
            <option value="FAMILY_BUNDLE">Forfait famille (prix total)</option>
            <option value="SECOND_DISCIPLINE">Réduction 2e discipline (%)</option>
          </select>
          {(kind === "PERCENT_OFF" || kind === "SECOND_DISCIPLINE") && (
            <input
              className="field"
              placeholder="% de réduction"
              value={percentOff}
              onChange={(e) => setPercentOff(e.target.value)}
            />
          )}
          {kind === "FIXED_OFF" && (
            <input
              className="field"
              placeholder="Montant offert par ligne (€)"
              value={percentOff}
              onChange={(e) => setPercentOff(e.target.value)}
            />
          )}
          {kind === "FAMILY_BUNDLE" && (
            <>
              <input
                className="field"
                placeholder="Prix total du forfait (€)"
                value={bundlePrice}
                onChange={(e) => setBundlePrice(e.target.value)}
              />
              <input
                className="field"
                placeholder="Nombre min. d'inscriptions dans le devis"
                value={minMembers}
                onChange={(e) => setMinMembers(e.target.value)}
              />
              <p className="text-xs text-[var(--muted-foreground)]">
                Les élèves existants doivent être dans le même foyer. Deux nouveaux élèves dans le même devis
                sont acceptés ; le foyer sera créé automatiquement à la validation.
              </p>
            </>
          )}
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Création…" : "Créer l'offre"}
          </button>
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
                {formatOfferRulesSummary(o as OfferLike)}
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
