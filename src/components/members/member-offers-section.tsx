"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Tag } from "lucide-react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { getOfferKindLabel } from "@/lib/offer-display";
import type { ApplicableOffer, MemberOfferContext } from "@/lib/offer-applicability";
import type { OfferKind } from "@prisma/client";

const relevanceLabels: Record<ApplicableOffer["relevance"], string> = {
  high: "Très pertinent",
  medium: "À considérer",
  general: "Général",
};

export function MemberOffersSection({ memberId, memberName }: { memberId: string; memberName: string }) {
  const [context, setContext] = useState<MemberOfferContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

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

  return (
    <section className="panel p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Offres applicables</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Offres actives classées selon le profil de {memberName}.
          </p>
        </div>
        <Link href={context?.createOfferHref ?? `/offers?memberId=${memberId}`} className="btn btn-ghost text-sm">
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
        <p className="text-sm text-[var(--muted-foreground)]">Chargement des offres…</p>
      ) : offers.length === 0 ? (
        <p className="text-sm text-[var(--muted-foreground)]">Aucune offre active pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {offers.map((offer) => (
            <li key={offer.id} className="rounded-xl border border-[var(--border)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
                <Link href={offer.enrollmentHref} className="btn btn-primary btn-block-mobile text-sm sm:w-auto">
                  Utiliser à l&apos;inscription
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
