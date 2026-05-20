"use client";

import { FormEvent, useEffect, useState } from "react";
import { FeedbackMessage } from "@/components/ui/feedback-message";

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
    load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="panel p-5">
        <h2 className="mb-4 text-lg font-semibold">Créer une offre</h2>
        {message && <FeedbackMessage variant="error" message={message} />}
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Nom de l'offre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <select
            className="w-full rounded border px-3 py-2"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="PERCENT_OFF">Réduction %</option>
            <option value="FIXED_OFF">Montant fixe offert (€)</option>
            <option value="FAMILY_BUNDLE">Forfait famille</option>
            <option value="SECOND_DISCIPLINE">2e discipline</option>
          </select>
          {(kind === "PERCENT_OFF" || kind === "SECOND_DISCIPLINE") && (
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="% de réduction"
              value={percentOff}
              onChange={(e) => setPercentOff(e.target.value)}
            />
          )}
          {kind === "FIXED_OFF" && (
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="Montant en €"
              value={percentOff}
              onChange={(e) => setPercentOff(e.target.value)}
            />
          )}
          {kind === "FAMILY_BUNDLE" && (
            <>
              <input
                className="w-full rounded border px-3 py-2"
                placeholder="Prix forfait famille (€)"
                value={bundlePrice}
                onChange={(e) => setBundlePrice(e.target.value)}
              />
              <input
                className="w-full rounded border px-3 py-2"
                placeholder="Nombre min. de membres"
                value={minMembers}
                onChange={(e) => setMinMembers(e.target.value)}
              />
            </>
          )}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Création…" : "Créer l'offre"}
          </button>
        </form>
      </section>
      <section className="panel p-5">
        <h2 className="mb-4 text-lg font-semibold">Offres actives</h2>
        <ul className="space-y-2 text-sm">
          {offers.map((o) => (
            <li key={o.id} className="rounded border p-3">
              <p className="font-medium">{o.name}</p>
              <p className="text-[var(--muted-foreground)]">{o.kind}</p>
            </li>
          ))}
          {offers.length === 0 && (
            <p className="text-[var(--muted-foreground)]">Aucune offre — créez-en une à gauche.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
