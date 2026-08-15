"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OffersActiveList } from "@/components/offers/offers-active-list";
import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FieldControl } from "@/components/ui/field-control";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormActions } from "@/components/ui/form-layout";
import { usePagination } from "@/components/ui/pagination";
import type { OfferLike } from "@/lib/offer-display";
import {
  formatOfferRulesSummary,
  getOfferKindLabel,
} from "@/lib/offer-display";
import { formatMoneyFromMajorInput, MONEY_INPUT_SUFFIX } from "@/lib/money";
import type { OfferKind } from "@prisma/client";

type OfferRow = OfferLike;

type OfferKindValue = "PERCENT_OFF" | "FIXED_OFF" | "FAMILY_BUNDLE" | "SECOND_DISCIPLINE";

type OffersManagerProps = {
  sportsOptions: Array<{ id: string; name: string }>;
  allowedPlanScopes?: Array<"ALL" | "CLASS" | "GYM" | "MIXED">;
  classModuleEnabled?: boolean;
};

const OFFER_KIND_HELP: Record<OfferKindValue, { title: string; example: string }> = {
  PERCENT_OFF: {
    title: "Remise simple sur le devis",
    example: "Exemple : -10 % sur une inscription de lancement ou une promotion courte.",
  },
  FIXED_OFF: {
    title: "Montant fixe retiré",
    example: "Exemple : -20 TND sur les frais du premier mois, sans changer le quota de séances.",
  },
  FAMILY_BUNDLE: {
    title: "Prix global pour plusieurs élèves",
    example: "Exemple : deux enfants du même foyer paient 70 TND au total au lieu de deux abonnements séparés.",
  },
  SECOND_DISCIPLINE: {
    title: "Réduction pour une discipline ajoutée",
    example: "Exemple : un élève déjà inscrit prend kick boxing et reçoit -30 % sur la deuxième discipline.",
  },
};

type OfferTemplateKey = "family" | "second-discipline" | "launch" | "manual";

const OFFER_TEMPLATES: Array<{ key: OfferTemplateKey; label: string; description: string }> = [
  { key: "family", label: "Réduction famille", description: "Forfait simple pour plusieurs élèves du même foyer." },
  { key: "second-discipline", label: "Deuxième discipline", description: "Remise automatique quand un membre ajoute une discipline." },
  { key: "launch", label: "Promotion lancement", description: "Pourcentage court sur les nouvelles inscriptions." },
  { key: "manual", label: "Remise manuelle", description: "Montant fixe contrôlé par l'équipe." },
];

export function OffersManager({
  sportsOptions,
  allowedPlanScopes = ["ALL", "CLASS"],
  classModuleEnabled = true,
}: OffersManagerProps) {
  const searchParams = useSearchParams();
  const contextMemberId = searchParams.get("memberId") ?? "";
  const requestedKind = searchParams.get("kind") as OfferKindValue | null;
  const initialKind = requestedKind === "SECOND_DISCIPLINE" && !classModuleEnabled
    ? "PERCENT_OFF"
    : requestedKind ?? "PERCENT_OFF";

  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<OfferKindValue>(initialKind);
  const [percentOff, setPercentOff] = useState("10");
  const [fixedAmount, setFixedAmount] = useState("");
  const [bundlePrice, setBundlePrice] = useState("");
  const [minMembers, setMinMembers] = useState("2");
  const [maxMembers, setMaxMembers] = useState("");
  const [sportId, setSportId] = useState("");
  const [planScope, setPlanScope] = useState<"ALL" | "CLASS" | "GYM" | "MIXED">("ALL");
  const [requiresHousehold, setRequiresHousehold] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteOffer, setPendingDeleteOffer] = useState<OfferRow | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(Boolean(contextMemberId || searchParams.get("kind")));

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
  const pagination = usePagination(filteredOffers, 12, searchTerm);

  const offerPreview = useMemo(() => {
    if (kind === "PERCENT_OFF") {
      return `${percentOff || "0"} % de réduction${maxMembers ? ` sur ${maxMembers} inscription(s) maximum` : " sur les lignes éligibles"}.`;
    }
    if (kind === "SECOND_DISCIPLINE") {
      return `${percentOff || "0"} % de réduction lorsqu'un membre ajoute une deuxième discipline.`;
    }
    if (kind === "FIXED_OFF") {
      return `${formatMoneyFromMajorInput(fixedAmount)} retiré par inscription${maxMembers ? `, pour ${maxMembers} ligne(s) maximum` : ""}.`;
    }
    const discipline = sportsOptions.find((sport) => sport.id === sportId)?.name ?? "toutes les disciplines";
    return `Prix total ${formatMoneyFromMajorInput(bundlePrice)} à partir de ${minMembers || "0"} inscription(s), pour ${discipline}${requiresHousehold ? ", avec foyer commun requis" : ""}.`;
  }, [
    bundlePrice,
    fixedAmount,
    kind,
    maxMembers,
    minMembers,
    percentOff,
    requiresHousehold,
    sportId,
    sportsOptions,
  ]);

  function openCreateForm() {
    setIsCreateOpen(true);
    window.requestAnimationFrame(() => {
      document.getElementById("offer-create")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function applyTemplate(template: OfferTemplateKey) {
    setIsCreateOpen(true);
    setSportId("");
    setMaxMembers("");
    if (template === "family") {
      setName("Réduction famille");
      setKind("FAMILY_BUNDLE");
      setMinMembers("2");
      setBundlePrice("70");
      setRequiresHousehold(true);
      setPercentOff("10");
      setFixedAmount("");
      return;
    }
    if (template === "second-discipline") {
      setName("Deuxième discipline");
      setKind("SECOND_DISCIPLINE");
      setPercentOff("30");
      setFixedAmount("");
      setBundlePrice("");
      return;
    }
    if (template === "launch") {
      setName("Promotion lancement");
      setKind("PERCENT_OFF");
      setPercentOff("10");
      setFixedAmount("");
      setBundlePrice("");
      return;
    }
    setName("Remise manuelle");
    setKind("FIXED_OFF");
    setFixedAmount("20");
    setBundlePrice("");
    setPercentOff("10");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const payload: Record<string, unknown> = {
      name,
      kind,
      isActive: true,
      planScope,
    };

    if (kind === "PERCENT_OFF" || kind === "SECOND_DISCIPLINE") {
      payload.percentOff = parseInt(percentOff, 10);
      if (kind === "PERCENT_OFF" && maxMembers.trim()) {
        payload.maxMembers = parseInt(maxMembers, 10);
      }
    } else if (kind === "FIXED_OFF") {
      payload.amountOffCents = Math.round(parseFloat(fixedAmount.replace(",", ".")) * 100);
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
    setFixedAmount("");
    setBundlePrice("");
    setMaxMembers("");
    setIsCreateOpen(false);
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
      <OffersActiveList
        offers={offers}
        pageItems={pagination.pageItems}
        filteredCount={filteredOffers.length}
        searchTerm={searchTerm}
        currentPage={pagination.currentPage}
        pageCount={pagination.pageCount}
        deletingId={deletingId}
        pageSize={12}
        onSearchChange={setSearchTerm}
        onClearSearch={() => setSearchTerm("")}
        onOpenCreate={openCreateForm}
        onQueueDelete={setPendingDeleteOffer}
        onPageChange={pagination.setPage}
      />

      <section id="offer-create" className="panel order-2 scroll-mt-24 p-4 sm:p-5">
        <h2 className="mb-2 text-lg font-semibold">Créer une offre</h2>
        <p className="mb-4 text-sm text-[var(--muted-foreground)]">
          Choisissez un modèle simple, vérifiez l&apos;aperçu, puis retrouvez l&apos;offre dans le parcours{" "}
          <strong>Inscription</strong>.
        </p>
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          {OFFER_TEMPLATES.filter((template) => classModuleEnabled || template.key !== "second-discipline").map((template) => (
            <button
              key={template.key}
              type="button"
              onClick={() => applyTemplate(template.key)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-left transition hover:border-[var(--primary)]/35 hover:bg-[var(--primary)]/5"
            >
              <span className="block text-sm font-semibold text-[var(--foreground)]">{template.label}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-[var(--muted-foreground)]">
                {template.description}
              </span>
            </button>
          ))}
        </div>
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
        {!isCreateOpen ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-soft)]/45 px-3 py-4 text-sm text-[var(--muted-foreground)]">
            Sélectionnez un modèle ou utilisez le bouton <strong>Créer une offre</strong> pour ouvrir le formulaire.
          </div>
        ) : (
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
              <option value="FIXED_OFF">Montant fixe offert par ligne (TND)</option>
              <option value="FAMILY_BUNDLE">Forfait famille (prix total)</option>
              {classModuleEnabled ? <option value="SECOND_DISCIPLINE">Réduction 2e discipline (%)</option> : null}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-[var(--muted-foreground)]">
            Formules concernées
            <select className="field" value={planScope} onChange={(event) => setPlanScope(event.target.value as typeof planScope)}>
              {allowedPlanScopes.includes("ALL") ? <option value="ALL">Toutes les formules</option> : null}
              {allowedPlanScopes.includes("CLASS") ? <option value="CLASS">Cours collectifs</option> : null}
              {allowedPlanScopes.includes("GYM") ? <option value="GYM">Accès salle</option> : null}
              {allowedPlanScopes.includes("MIXED") ? <option value="MIXED">Packs mixtes</option> : null}
            </select>
          </label>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm">
            <p className="font-semibold text-[var(--foreground)]">{OFFER_KIND_HELP[kind].title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
              {OFFER_KIND_HELP[kind].example}
            </p>
          </div>
          <div className="rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/5 px-3 py-2.5 shadow-[var(--shadow-panel)]">
            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--primary)]">Aperçu</p>
            <p className="mt-1 text-sm text-[var(--foreground)]">{offerPreview}</p>
          </div>
          {(kind === "PERCENT_OFF" || kind === "SECOND_DISCIPLINE") && (
            <>
              <label className="grid gap-1 text-xs font-medium text-[var(--muted-foreground)]">
                Pourcentage de réduction
                <FieldControl suffix="%">
                  <input
                    className="field pr-10"
                    inputMode="numeric"
                    placeholder="10"
                    value={percentOff}
                    onChange={(e) => setPercentOff(e.target.value)}
                    required
                  />
                </FieldControl>
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
                Montant offert par ligne (TND)
                <FieldControl suffix={MONEY_INPUT_SUFFIX}>
                  <input className="field pr-10" inputMode="decimal" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} required />
                </FieldControl>
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
                Prix total du forfait (TND)
                <FieldControl suffix={MONEY_INPUT_SUFFIX}>
                  <input className="field pr-10" inputMode="decimal" value={bundlePrice} onChange={(e) => setBundlePrice(e.target.value)} required />
                </FieldControl>
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
        )}
      </section>

      <ConfirmDialog
        open={pendingDeleteOffer !== null}
        title="Désactiver cette offre ?"
        description={
          pendingDeleteOffer && (pendingDeleteOffer.applicationsCount ?? 0) > 0
            ? `L'offre « ${pendingDeleteOffer.name} » a déjà été utilisée ${pendingDeleteOffer.applicationsCount} fois. Elle sera désactivée, sans modifier les inscriptions existantes.`
            : `L'offre « ${pendingDeleteOffer?.name ?? ""} » ne sera plus proposée. Les inscriptions existantes seront conservées.`
        }
        confirmLabel="Désactiver l'offre"
        loading={deletingId === pendingDeleteOffer?.id}
        onCancel={() => setPendingDeleteOffer(null)}
        onConfirm={() => pendingDeleteOffer ? deleteOffer(pendingDeleteOffer) : undefined}
      />
    </div>
  );
}
