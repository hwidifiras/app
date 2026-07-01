"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleOff, Tag } from "lucide-react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { getOfferKindLabel } from "@/lib/offer-display";
import type { ApplicableOffer, MemberOfferContext } from "@/lib/offer-applicability";
import type { OfferKind } from "@prisma/client";

const relevanceLabels: Record<ApplicableOffer["relevance"], string> = {
  high: "Très pertinent",
  medium: "À considérer",
  general: "Général",
};

export function MemberOffersSection({
  memberId,
  memberName,
  wide = false,
}: {
  memberId: string;
  memberName: string;
  wide?: boolean;
}) {
  const [context, setContext] = useState<MemberOfferContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingDeleteOffer, setPendingDeleteOffer] = useState<ApplicableOffer | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/members/${memberId}/applicable-offers`)
      .then(async (response) => {
        const data = (await response.json()) as { data?: MemberOfferContext; error?: string };
        if (cancelled) return;
        if (!response.ok) {
          setMessage(data.error ?? "Impossible de charger les offres");
          setLoading(false);
          return;
        }
        setContext(data.data ?? { offers: [], suggestedCreateKind: null, createOfferHref: `/offers?memberId=${memberId}` });
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setMessage("Impossible de charger les offres");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [memberId]);

  const offers = context?.offers ?? [];

  async function deleteOffer(offer: ApplicableOffer) {
    setDeletingId(offer.id);
    setMessage(null);
    const response = await fetch("/api/offers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId: offer.id }),
    });
    const result = (await response.json()) as { error?: string };

    if (!response.ok) {
      setMessage(result.error ?? "Impossible de désactiver l'offre");
      setDeletingId(null);
      return;
    }

    setContext((current) =>
      current ? { ...current, offers: current.offers.filter((item) => item.id !== offer.id) } : current,
    );
    setPendingDeleteOffer(null);
    setMessage("Offre désactivée des offres actives.");
    setDeletingId(null);
  }

  return (
    <section className="panel min-w-0 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Offres applicables</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Offres actives classées selon le profil de {memberName}.
          </p>
        </div>
        <Link href={context?.createOfferHref ?? `/offers?memberId=${memberId}`} className="btn btn-ghost btn-sm">
          Créer une offre
        </Link>
      </div>

      {context?.suggestedCreateKind ? (
        <p className="mb-4 text-xs text-[var(--muted-foreground)]">
          Suggestion : {getOfferKindLabel(context.suggestedCreateKind as OfferKind)} selon le profil de l&apos;élève.
        </p>
      ) : null}

      <FeedbackMessage message={message} />

      {loading ? (
        <LoadingSkeleton lines={2} />
      ) : offers.length === 0 ? (
        <EmptyState
          icon={<Tag className="size-8 opacity-45" />}
          title="Aucune offre applicable"
          message="Créez une offre ou poursuivez l'inscription sans réduction."
          action={
            <Link href={context?.createOfferHref ?? `/offers?memberId=${memberId}`} className="btn btn-ghost">
              Créer une offre
            </Link>
          }
          className="px-3 py-7"
        />
      ) : (
        <ul
          className={
            wide
              ? "grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,19rem),1fr))]"
              : "space-y-3"
          }
        >
          {offers.map((offer) => (
            <li key={offer.id} className="h-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)]/35 p-3 shadow-[var(--shadow-panel)]">
              <div className="flex h-full flex-col gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag className="size-4 text-[var(--primary)]" />
                    <p className="font-medium text-[var(--foreground)]">{offer.name}</p>
                    <span className="rounded-full bg-[var(--primary)]/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--primary)]">
                      {relevanceLabels[offer.relevance]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-[var(--primary)]">
                    {getOfferKindLabel(offer.kind as OfferKind)}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{offer.summary}</p>
                  {offer.hint ? (
                    <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">{offer.hint}</p>
                  ) : null}
                </div>
                <div className="grid shrink-0 grid-cols-2 gap-2">
                  <Link href={offer.enrollmentHref} className="btn btn-primary btn-block-mobile text-sm sm:w-auto">
                    Utiliser
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteOffer(offer)}
                    disabled={deletingId !== null}
                    className="btn btn-ghost btn-block-mobile btn-sm border-[var(--danger)]/25 text-[var(--danger)] sm:w-auto"
                  >
                    <CircleOff className="size-3.5" />
                    {deletingId === offer.id ? "Désactivation…" : "Désactiver"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDeleteOffer !== null}
        title="Désactiver cette offre ?"
        description={`L'offre « ${pendingDeleteOffer?.name ?? ""} » ne sera plus proposée à ${memberName}. Les inscriptions existantes seront conservées.`}
        confirmLabel="Désactiver l'offre"
        loading={deletingId === pendingDeleteOffer?.id}
        onCancel={() => setPendingDeleteOffer(null)}
        onConfirm={() => pendingDeleteOffer ? deleteOffer(pendingDeleteOffer) : undefined}
      />
    </section>
  );
}
