import { CircleOff, Plus, Tag } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ListSearch } from "@/components/ui/list-controls";
import { Pagination } from "@/components/ui/pagination";
import type { OfferLike } from "@/lib/offer-display";
import { formatOfferRulesSummary, getOfferKindLabel } from "@/lib/offer-display";
import type { OfferKind } from "@prisma/client";

type OfferRow = OfferLike;

type OffersActiveListProps = {
  offers: OfferRow[];
  pageItems: OfferRow[];
  filteredCount: number;
  searchTerm: string;
  currentPage: number;
  pageCount: number;
  deletingId: string | null;
  pageSize: number;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  onOpenCreate: () => void;
  onQueueDelete: (offer: OfferRow) => void;
  onPageChange: (page: number) => void;
};

export function OffersActiveList({
  offers,
  pageItems,
  filteredCount,
  searchTerm,
  currentPage,
  pageCount,
  deletingId,
  pageSize,
  onSearchChange,
  onClearSearch,
  onOpenCreate,
  onQueueDelete,
  onPageChange,
}: OffersActiveListProps) {
  return (
    <section className="panel order-1 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Offres actives</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {filteredCount} offre{filteredCount > 1 ? "s" : ""} affichée{filteredCount > 1 ? "s" : ""}
          </p>
        </div>
        <button type="button" onClick={onOpenCreate} className="btn btn-primary btn-block-mobile min-h-11 sm:w-auto">
          <Plus className="size-4" />
          Créer une offre
        </button>
      </div>

      <ListSearch value={searchTerm} onChange={onSearchChange} placeholder="Rechercher une offre..." />
      {filteredCount === 0 ? (
        <EmptyState
          className="mt-4"
          icon={<Tag className="size-8 opacity-45" />}
          title={offers.length === 0 ? "Aucune offre active" : "Aucun résultat"}
          message={offers.length === 0 ? "Créez une offre avec un modèle simple." : "Essayez une autre recherche."}
          action={
            searchTerm ? (
              <button type="button" onClick={onClearSearch} className="btn btn-ghost">
                Effacer la recherche
              </button>
            ) : (
              <button type="button" onClick={onOpenCreate} className="btn btn-primary">
                Créer une offre
              </button>
            )
          }
        />
      ) : (
        <ul className="mt-4 max-h-[65dvh] space-y-2 overflow-y-auto pr-1 text-sm">
          {pageItems.map((offer) => (
            <li key={offer.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)]/35 p-3 shadow-[var(--shadow-panel)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--foreground)]">{offer.name}</p>
                  <p className="text-xs font-semibold text-[var(--primary)]">{getOfferKindLabel(offer.kind as OfferKind)}</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{formatOfferRulesSummary(offer)}</p>
                  <p className="mt-2 inline-flex rounded-full bg-[var(--surface)] px-2 py-1 text-[0.68rem] font-semibold text-[var(--muted-foreground)]">
                    {(offer.applicationsCount ?? 0) > 0
                      ? `${offer.applicationsCount} utilisation${(offer.applicationsCount ?? 0) > 1 ? "s" : ""} - historique conservé`
                      : "Pas encore utilisée"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onQueueDelete(offer)}
                  disabled={deletingId !== null}
                  className="btn btn-ghost btn-sm shrink-0 border-[var(--warning)]/35 px-2.5 py-2 text-[var(--warning)]"
                  title="Désactiver l'offre"
                  aria-label={`Désactiver ${offer.name}`}
                >
                  <CircleOff className="size-4" />
                  <span className="text-xs font-semibold">Désactiver</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination
        currentPage={currentPage}
        pageCount={pageCount}
        totalItems={filteredCount}
        pageSize={pageSize}
        onPageChange={onPageChange}
      />
    </section>
  );
}
