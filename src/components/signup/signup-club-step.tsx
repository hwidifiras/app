"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Loader2, MapPin, Phone, XCircle } from "lucide-react";

import { signupApi } from "@/components/signup/signup-client";
import type { SignupClubDraft } from "@/components/signup/signup-types";
import { FeedbackMessage } from "@/components/ui/feedback-message";

type SlugState =
  | { status: "idle" | "checking" }
  | { status: "available"; slug: string }
  | { status: "unavailable"; slug: string; reason?: string };

function suggestSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

export function SignupClubStep({
  configDomain,
  initialDraft,
  onBack,
  onContinue,
}: {
  configDomain: string;
  initialDraft: SignupClubDraft;
  onBack?: () => void;
  onContinue: (draft: SignupClubDraft) => void;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [slugTouched, setSlugTouched] = useState(Boolean(initialDraft.slug));
  const [slugState, setSlugState] = useState<SlugState>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const normalized = suggestSlug(draft.slug);
    if (normalized.length < 3) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSlugState({ status: "checking" });
      try {
        const data = await signupApi<{
          available: boolean;
          slug: string;
          reason?: string;
        }>(`/api/saas-signup/slug?value=${encodeURIComponent(normalized)}`, {
          signal: controller.signal,
        });
        if (data.available) {
          setSlugState({ status: "available", slug: data.slug });
        } else {
          setSlugState({ status: "unavailable", slug: data.slug, reason: data.reason });
        }
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setSlugState({ status: "unavailable", slug: normalized });
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [draft.slug]);

  const normalizedSlug = useMemo(() => suggestSlug(draft.slug), [draft.slug]);
  const canContinue = draft.clubName.trim().length >= 2
    && slugState.status === "available"
    && slugState.slug === normalizedSlug;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!canContinue) {
      setError("Choisissez une adresse d'espace disponible.");
      return;
    }
    onContinue({
      clubName: draft.clubName.trim(),
      clubPhone: draft.clubPhone.trim(),
      clubAddress: draft.clubAddress.trim(),
      slug: normalizedSlug,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FeedbackMessage message={error} variant="error" />

      <div className="space-y-1.5">
        <label htmlFor="signup-club-name" className="text-sm font-semibold">Nom du club</label>
        <div className="field-control">
          <Building2 className="field-control-icon" />
          <input
            id="signup-club-name"
            className="field has-leading-icon"
            value={draft.clubName}
            onChange={(event) => {
              const clubName = event.target.value;
              setSlugState({ status: "idle" });
              setDraft((current) => ({
                ...current,
                clubName,
                slug: slugTouched ? current.slug : suggestSlug(clubName),
              }));
            }}
            autoComplete="organization"
            placeholder="Dojo El Manar"
            minLength={2}
            maxLength={120}
            autoFocus
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="signup-slug" className="text-sm font-semibold">Adresse de votre espace</label>
        <div className="flex min-w-0 items-stretch rounded-lg border border-[#D8E2F0] bg-white focus-within:border-[#2563EB] focus-within:ring-3 focus-within:ring-[#DBEAFE]">
          <input
            id="signup-slug"
            className="min-w-0 flex-1 rounded-l-lg bg-transparent px-3 py-3 text-base outline-none"
            value={draft.slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlugState({ status: "idle" });
              setDraft((current) => ({ ...current, slug: suggestSlug(event.target.value) }));
            }}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="dojo-el-manar"
            maxLength={48}
            required
          />
          <span className="flex max-w-[48%] items-center truncate rounded-r-lg border-l border-[#D8E2F0] bg-[#F8FAFC] px-3 text-xs font-semibold text-[#64748B] sm:text-sm">
            .{configDomain}
          </span>
        </div>
        <div className="min-h-5 text-xs">
          {slugState.status === "checking" ? (
            <span className="inline-flex items-center gap-1.5 text-[#64748B]"><Loader2 className="size-3.5 animate-spin" />Vérification...</span>
          ) : slugState.status === "available" ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700"><CheckCircle2 className="size-3.5" />Adresse disponible</span>
          ) : slugState.status === "unavailable" ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-red-700"><XCircle className="size-3.5" />Choisissez une autre adresse</span>
          ) : (
            <span className="text-[#64748B]">Au moins 3 caractères, sans espaces ni accents.</span>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="signup-club-phone" className="text-sm font-semibold">Téléphone <span className="font-normal text-[#64748B]">(facultatif)</span></label>
          <div className="field-control">
            <Phone className="field-control-icon" />
            <input id="signup-club-phone" className="field has-leading-icon" type="tel" value={draft.clubPhone} onChange={(event) => setDraft((current) => ({ ...current, clubPhone: event.target.value }))} autoComplete="tel" placeholder="+216 20 000 000" maxLength={30} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="signup-club-address" className="text-sm font-semibold">Ville ou adresse <span className="font-normal text-[#64748B]">(facultatif)</span></label>
          <div className="field-control">
            <MapPin className="field-control-icon" />
            <input id="signup-club-address" className="field has-leading-icon" value={draft.clubAddress} onChange={(event) => setDraft((current) => ({ ...current, clubAddress: event.target.value }))} autoComplete="street-address" placeholder="Tunis" maxLength={200} />
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-between">
        {onBack ? <button type="button" className="btn btn-ghost" onClick={onBack}><ArrowLeft className="size-4" />Retour</button> : <span />}
        <button type="submit" className="btn btn-primary btn-lg" disabled={!canContinue}>Choisir mes activités<ArrowRight className="size-4" /></button>
      </div>
    </form>
  );
}
