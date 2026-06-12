"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tag, Trash2 } from "lucide-react";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormActions } from "@/components/ui/form-layout";
import { ListSearch } from "@/components/ui/list-controls";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteOffer, setPendingDeleteOffer] = useState<OfferRow | null>(null);

  const contextHint = useMemo(() => {
    if (!contextMemberId) return null;
    return "Création contextualisée depuis la fiche élève — l'offre sera utilisable à l'inscription.";
  }, [contextMemberId]);

  const load = useCallback(() => {
    fetch("/api/offers")
      .then((r) => r.json())
      .then((d) => setOffers(d.data ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredOffers = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase("fr");
    if (!query) return offers;
    return offers.filter((offer) =>
      offer.name.toLocaleLowerCase("fr").includes(query) ||
      getOfferKindLabel(offer.kind as OfferKind).toLocaleLowerCase("fr").includes(query) ||
      formatOfferRulesSummary(offer).toLocaleLowerCase("fr").includes(query),
    );
  }, [offers, searchTerm]);

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

  async function deleteOffer(offer: OfferRow) {
    setDeletingId(offer.id);
    setMessage(null);
    const response = await fetch("/api/offers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId: offer.id }),
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error ?? "Impossible de désactiver l'offre");
      setDeletingId(null);
      return;
    }

    setOffers((current) => current.filter((item) => item.id !== offer.id));
    setPendingDeleteOffer(null);
    setMessage("Offre désactivée.");
    setDeletingId(null);
  }

  return (
    <div className="grid items-start gap-4 sm:gap-5 lg:grid-cols-2">
      <section className="panel order-2 p-4 sm:p-5 lg:order-1">
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
          <label className="grid gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Nom de l&apos;offre
            <input
              className="field"
              placeholder="Ex. Famille 2 personnes"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Type de réduction
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
          </label>
          {(kind === "PERCENT_OFF" || kind === "SECOND_DISCIPLINE") && (
            <>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted-foreground)]">
                Pourcentage de réduction
                <input
                  className="field"
                  inputMode="numeric"
                  placeholder="10"
                  value={percentOff}
                  onChange={(e) => setPercentOff(e.target.value)}
                  required
                />
              </label>
              {kind === "PERCENT_OFF" ? (
                <label className="grid gap-1 text-xs font-medium text-[var(--muted-foreground)]">
                  Nombre maximum de lignes
                  <input
                    className="field"
                    inputMode="numeric"
                    placeholder="Optionnel"
                    value={maxMembers}
                    onChange={(e) => setMaxMembers(e.target.value)}
                  />
                </label>
              ) : null}
            </>
          )}
          {kind === "FIXED_OFF" && (
            <>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted-foreground)]">
                Montant offert par ligne (€)
                <input className="field" inputMode="decimal" value={fixedAmountEur} onChange={(e) => setFixedAmountEur(e.target.value)} required />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted-foreground)]">
                Nombre maximum de lignes
                <input className="field" inputMode="numeric" placeholder="Optionnel" value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)} />
              </label>
            </>
          )}
          {kind === "FAMILY_BUNDLE" && (
            <>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted-foreground)]">
                Prix total du forfait (€)
                <input className="field" inputMode="decimal" value={bundlePrice} onChange={(e) => setBundlePrice(e.target.value)} required />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted-foreground)]">
                Nombre minimum d&apos;inscriptions
                <input className="field" inputMode="numeric" value={minMembers} onChange={(e) => setMinMembers(e.target.value)} required />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted-foreground)]">
                Discipline
                <select className="field" value={sportId} onChange={(e) => setSportId(e.target.value)}>
                  <option value="">Toutes les disciplines</option>
                  {sportsOptions.map((sport) => (
                    <option key={sport.id} value={sport.id}>{sport.name}</option>
                  ))}
                </select>
              </label>
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
      <section className="panel order-1 p-4 sm:p-5 lg:order-2 lg:sticky lg:top-[4.5rem]">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Offres actives</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {filteredOffers.length} offre{filteredOffers.length > 1 ? "s" : ""} affichée{filteredOffers.length > 1 ? "s" : ""}
          </p>
        </div>
        <ListSearch value={searchTerm} onChange={setSearchTerm} placeholder="Rechercher une offre..." />
        {filteredOffers.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={<Tag className="size-8 opacity-45" />}
            title={offers.length === 0 ? "Aucune offre active" : "Aucun résultat"}
            message={offers.length === 0 ? "Créez une offre avec le formulaire." : "Essayez une autre recherche."}
            action={
              searchTerm ? (
                <button type="button" onClick={() => setSearchTerm("")} className="btn btn-ghost">
                  Effacer la recherche
                </button>
              ) : undefined
            }
          />
        ) : (
          <ul className="mt-4 max-h-[65dvh] space-y-2 overflow-y-auto pr-1 text-sm">
            {filteredOffers.map((offer) => (
              <li key={offer.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]/35 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--foreground)]">{offer.name}</p>
                    <p className="text-xs font-semibold text-[var(--primary)]">
                      {getOfferKindLabel(offer.kind as OfferKind)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      {formatOfferRulesSummary(offer)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteOffer(offer)}
                    disabled={deletingId !== null}
                    className="btn btn-ghost btn-sm shrink-0 border-[var(--danger)]/25 p-2 text-[var(--danger)]"
                    title="Désactiver l'offre"
                    aria-label={`Désactiver ${offer.name}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={pendingDeleteOffer !== null}
        title="Désactiver cette offre ?"
        description={`L'offre « ${pendingDeleteOffer?.name ?? ""} » ne sera plus proposée. Les inscriptions existantes seront conservées.`}
        confirmLabel="Désactiver l'offre"
        loading={deletingId === pendingDeleteOffer?.id}
        onCancel={() => setPendingDeleteOffer(null)}
        onConfirm={() => pendingDeleteOffer ? deleteOffer(pendingDeleteOffer) : undefined}
      />
    </div>
  );
}
