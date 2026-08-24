"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";
import { EnrollmentCompletionPanel } from "@/components/enrollment/enrollment-completion-panel";
import { EnrollmentLineEditor } from "@/components/enrollment/enrollment-line-editor";
import { EnrollmentQuotePanel } from "@/components/enrollment/enrollment-quote-panel";
import { EnrollmentStepper } from "@/components/enrollment/enrollment-stepper";
import { EnrollmentSummarySidebar, type EnrollmentLineSummary } from "@/components/enrollment/enrollment-summary-sidebar";
import {
  lineCompatibilityIssue,
  newEnrollmentLine,
  type Gender,
  type GroupOption,
  type GroupGenderPolicy,
  type GroupType,
  type LineState,
  type MemberOption,
  type MemberType,
  type PlanOption,
  type QuoteData,
} from "@/components/enrollment/enrollment-types";
import type { OfferLike } from "@/lib/offer-display";
import { useIdempotencyIntent } from "@/hooks/use-idempotency-intent";
import {
  formatOfferRulesSummary,
  getOfferEnrollmentHint,
  getOfferKindLabel,
} from "@/lib/offer-display";
import { formatMoney } from "@/lib/money";
import { formatPaymentPrefill } from "@/lib/subscription-billing";
import type { EnrollmentUndoSnapshot } from "@/lib/enrollment-undo";
import type { OfferKind } from "@prisma/client";

type OfferOption = OfferLike;

type EnrollmentCompletion = {
  memberIds: string[];
  receipts: Array<{ id: string; receiptNumber: string }>;
  undoSnapshot: EnrollmentUndoSnapshot;
  recoveryKey?: string | null;
};

export function EnrollmentWizard({
  initialMemberId = "",
  initialOfferId = "",
  initialStep = 1,
  receiptPrintDefault = true,
}: {
  initialMemberId?: string;
  initialOfferId?: string;
  initialStep?: number;
  receiptPrintDefault?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep >= 2 && initialStep <= 3 ? initialStep : 1);
  const [lines, setLines] = useState<LineState[]>([newEnrollmentLine(initialMemberId)]);
  const [offerId, setOfferId] = useState(initialOfferId);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [offers, setOffers] = useState<OfferOption[]>([]);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [completion, setCompletion] = useState<EnrollmentCompletion | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const enrollmentIntent = useIdempotencyIntent();
  const activeStepHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef(step);

  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;
    const frame = window.requestAnimationFrame(() => activeStepHeadingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/enrollment/context?type=class", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Impossible de charger l'inscription");
        return payload.data as Record<string, unknown>;
      })
      .then((context) => {
      if (cancelled) return;
      const contextMembers = context.members as Array<Record<string, unknown>> | undefined;
      const contextGroups = context.groups as Array<Record<string, unknown>> | undefined;
      const contextPlans = context.plans as Array<Record<string, unknown>> | undefined;
      const contextOffers = context.offers as OfferOption[] | undefined;
      setMembers(
        (contextMembers ?? []).map((x) => ({
          id: x.id as string,
          firstName: x.firstName as string,
          lastName: x.lastName as string,
          phone: x.phone as string,
          memberType: (x.memberType as MemberType | undefined) ?? "NOT_SPECIFIED",
          gender: (x.gender as Gender | undefined) ?? "NOT_SPECIFIED",
        })),
      );
      setGroups(
        (contextGroups ?? []).map((x) => ({
          id: x.id as string,
          name: x.name as string,
          sportId: x.sportId as string,
          sportName: (x.sport as { name: string })?.name ?? "",
          groupType: (x.groupType as GroupType | undefined) ?? "ADULTS",
          genderPolicy: (x.genderPolicy as GroupGenderPolicy | undefined) ?? "MIXED",
          capacity: x.capacity as number,
          activeMembers: (x.activeMembers as number) ?? (x._count as { members: number })?.members ?? 0,
        })),
      );
      setPlans(
        (contextPlans ?? []).map((x) => ({
          id: x.id as string,
          name: x.name as string,
          price: x.price as number,
          sportId: x.sportId as string,
          sportName: (x.sport as { name: string })?.name ?? "",
        })),
      );
      setOffers(contextOffers ?? []);
    })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Impossible de charger l'inscription");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const buildPayload = useCallback(() => {
    return {
      lines: lines
        .map((line) => {
          const paymentCents = Math.round(parseFloat(line.paymentCents.replace(",", ".")) * 100) || 0;
          if (line.mode === "existing" && line.memberId) {
            return {
              memberId: line.memberId,
              groupId: line.groupId,
              planId: line.planId,
              paymentCents: paymentCents > 0 ? paymentCents : undefined,
              paymentMethod: line.paymentMethod,
            };
          }
          if (line.mode === "new") {
            return {
              newMember: {
                firstName: line.newFirstName,
                lastName: line.newLastName,
                phone: line.newPhone,
                memberType: line.memberType,
                gender: line.gender,
                parentName: line.memberType === "KID" ? line.parentName : "",
                parentPhone: line.memberType === "KID" ? line.parentPhone : "",
                parentAddress: line.memberType === "KID" ? line.parentAddress : "",
              },
              groupId: line.groupId,
              planId: line.planId,
              paymentCents: paymentCents > 0 ? paymentCents : undefined,
              paymentMethod: line.paymentMethod,
            };
          }
          return null;
        })
        .filter(Boolean),
      offerId: offerId || undefined,
    };
  }, [lines, offerId]);

  async function fetchQuote() {
    const firstIssue = lines
      .map((line) => lineCompatibilityIssue(line, members, groups))
      .find(Boolean);
    if (firstIssue) {
      setMessage(firstIssue);
      return;
    }
    setLoading(true);
    setMessage(null);
    const payload = buildPayload();
    const res = await fetch("/api/enrollment/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Erreur devis");
      return;
    }
    setQuote(data.data);
    const quoteData = data.data as QuoteData;
    setLines((prev) =>
      prev.map((row, index) => {
        const quoteLine = quoteData.lines[index];
        if (!quoteLine || quoteLine.blocked) return row;
        return {
          ...row,
          paymentCents: formatPaymentPrefill(quoteLine.finalAmountCents),
        };
      }),
    );
    setStep(3);
  }

  async function applyEnrollment(e: FormEvent) {
    e.preventDefault();
    if (completed) return;
    setLoading(true);
    setMessage(null);
    const requestPayload = buildPayload();
    let res: Response;
    try {
      res = await fetch("/api/enrollment/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": enrollmentIntent.keyFor(requestPayload),
        },
        body: JSON.stringify(requestPayload),
      });
    } catch {
      setLoading(false);
      setMessage("Connexion interrompue. Réessayez : l'inscription ne sera pas créée deux fois.");
      return;
    }
    const data = await res.json() as {
      data?: {
        memberIds: string[];
        receipts?: Array<{ id: string; receiptNumber: string }>;
        undoSnapshot: EnrollmentUndoSnapshot;
        recoveryKey?: string | null;
      };
      error?: string;
    };
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Erreur inscription");
      return;
    }
    enrollmentIntent.complete(requestPayload);

    const memberIds = data.data?.memberIds ?? [];
    const receipts = data.data?.receipts ?? [];
    const undoSnapshot = data.data?.undoSnapshot;
    setCompleted(true);
    setCompletion(undoSnapshot ? { memberIds, receipts, undoSnapshot, recoveryKey: data.data?.recoveryKey ?? null } : null);
    setVoidReason("");
    setMessage("Inscription confirmée.");
    router.refresh();
  }

  async function voidCompletedEnrollment() {
    if (!completion) return;
    const reason = voidReason.trim();
    if (reason.length < 3) {
      setMessage("Motif obligatoire pour annuler cette inscription.");
      return;
    }

    setVoiding(true);
    setMessage(null);
    const requestPayload = {
      undoSnapshot: completion.undoSnapshot,
      recoveryKey: completion.recoveryKey,
      reason,
    };
    let res: Response;
    try {
      res = await fetch("/api/enrollment/revert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": enrollmentIntent.keyFor(requestPayload),
        },
        body: JSON.stringify(requestPayload),
      });
    } catch {
      setVoiding(false);
      setMessage("Connexion interrompue. Réessayez sans risque de doubler l'annulation.");
      return;
    }
    const data = (await res.json()) as { data?: { voided: boolean }; error?: string };
    setVoiding(false);

    if (!res.ok || !data.data?.voided) {
      setMessage(data.error ?? "Impossible d'annuler cette inscription.");
      return;
    }
    enrollmentIntent.complete(requestPayload);

    setCompleted(false);
    setCompletion(null);
    setQuote(null);
    setVoidReason("");
    setStep(1);
    setMessage("Inscription annulee avec trace: paiements inverses, recus annules, abonnements resilies et affectations fermees si applicable.");
    router.refresh();
  }

  function resetTransientState() {
    setMessage(null);
    setQuote(null);
    setCompleted(false);
    setCompletion(null);
    setVoidReason("");
  }

  function updateLine(lineKey: string, next: LineState) {
    resetTransientState();
    setLines((prev) => prev.map((line) => (line.key === lineKey ? next : line)));
  }

  function removeLine(lineKey: string) {
    resetTransientState();
    setLines((prev) => prev.filter((line) => line.key !== lineKey));
  }

  function plansForGroup(groupId: string) {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return [];
    return plans.filter((p) => p.sportId === g.sportId);
  }

  function updateQuoteLinePayment(lineIndex: number, value: string) {
    setMessage(null);
    setLines((prev) =>
      prev.map((row, index) => (index === lineIndex ? { ...row, paymentCents: value } : row)),
    );
  }

  const selectedOffer = useMemo(
    () => offers.find((o) => o.id === offerId) ?? null,
    [offers, offerId],
  );

  const offerHint = useMemo(() => {
    if (!selectedOffer) return null;
    return getOfferEnrollmentHint(selectedOffer, lines.length);
  }, [selectedOffer, lines.length]);

  const selectedCount = useMemo(
    () => lines.filter((l) => l.mode === "existing" && l.memberId).length,
    [lines],
  );

  const lineIssues = useMemo(
    () => lines.map((line) => lineCompatibilityIssue(line, members, groups)),
    [groups, lines, members],
  );

  const linesComplete = lines.every(
    (l) =>
      l.groupId &&
      l.planId &&
      ((l.mode === "existing" && l.memberId) ||
        (l.mode === "new" &&
          l.newFirstName &&
          l.newLastName &&
          l.newPhone &&
          l.memberType !== "NOT_SPECIFIED" &&
          l.gender !== "NOT_SPECIFIED" &&
          (l.memberType !== "KID" || (l.parentName && l.parentPhone)))),
  );
  const linesValid = linesComplete && lineIssues.every((issue) => !issue);
  const lineSummaries = useMemo<Array<EnrollmentLineSummary & { index: number }>>(
    () =>
      lines.map((line, index) => {
        const member = members.find((item) => item.id === line.memberId);
        const group = groups.find((item) => item.id === line.groupId);
        const plan = plans.find((item) => item.id === line.planId);
        const missing: string[] = [];

        if (line.mode === "existing" && !line.memberId) missing.push("membre");
        if (line.mode === "new") {
          if (!line.newFirstName || !line.newLastName || !line.newPhone) missing.push("identité");
          if (line.memberType === "NOT_SPECIFIED") missing.push("adulte/enfant");
          if (line.gender === "NOT_SPECIFIED") missing.push("genre");
          if (line.memberType === "KID" && (!line.parentName || !line.parentPhone)) missing.push("parent");
        }
        if (!line.groupId) missing.push("groupe");
        if (!line.planId) missing.push("formule");
        if (lineIssues[index]) missing.push("compatibilité");

        return {
          key: line.key,
          index,
          title:
            line.mode === "existing"
              ? member
                ? `${member.firstName} ${member.lastName}`
                : "Membre à choisir"
              : line.newFirstName || line.newLastName
                ? `${line.newFirstName} ${line.newLastName}`.trim()
                : "Nouvel élève",
          groupName: group ? `${group.name} · ${group.sportName}` : "Groupe à choisir",
          planName: plan ? `${plan.name} · ${formatMoney(plan.price)}` : "Formule à choisir",
          missing,
          issue: lineIssues[index],
        };
      }),
    [groups, lineIssues, lines, members, plans],
  );
  const missingSummary = useMemo(
    () =>
      lineSummaries.flatMap((line) =>
        line.missing.map((item) => `Ligne ${line.index + 1}: ${item}`),
      ),
    [lineSummaries],
  );
  const quotePaidCents = useMemo(() => {
    if (!quote) return 0;
    return quote.lines.reduce((total, item) => {
      const paymentValue = lines[item.lineIndex]?.paymentCents ?? "";
      const paymentNumber = parseFloat(paymentValue.replace(",", "."));
      const paymentCents = Number.isFinite(paymentNumber) ? Math.max(0, Math.round(paymentNumber * 100)) : 0;
      return total + Math.min(paymentCents, item.finalAmountCents);
    }, 0);
  }, [lines, quote]);
  const quoteBalanceCents = quote ? Math.max(0, quote.totalFinalCents - quotePaidCents) : 0;

  return (
    <form onSubmit={applyEnrollment} className="enrollment-wizard space-y-6 pb-4 lg:pb-0">
      {message ? (
        <FeedbackMessage
          message={message}
          variant={
            completed
              ? "success"
              : message.startsWith("Impossible") || message.includes("Erreur")
                ? "error"
                : undefined
          }
        />
      ) : null}

      {completion ? (
        <EnrollmentCompletionPanel
          memberIds={completion.memberIds}
          receipts={completion.receipts}
          receiptPrintDefault={receiptPrintDefault}
          voidReason={voidReason}
          voiding={voiding}
          onVoidReasonChange={setVoidReason}
          onVoid={() => {
            void voidCompletedEnrollment();
          }}
        />
      ) : null}

      <EnrollmentStepper step={step} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="min-w-0 space-y-4">
          {step === 1 && (
            <section className="panel space-y-4 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary)]">1. Élève + cours</p>
                <h2 ref={activeStepHeadingRef} tabIndex={-1} className="mt-1 text-lg font-semibold outline-none">
                  Choisir qui s&apos;inscrit
                </h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Ajoutez une ligne par élève, puis choisissez son groupe et sa formule.
                </p>
              </div>
              {lines.map((line, idx) => (
                <fieldset key={line.key} className="enrollment-fieldset rounded-lg border border-[var(--border)] p-3 sm:p-4">
                  <legend className="px-1 text-sm font-medium">Ligne {idx + 1}</legend>
                  <EnrollmentLineEditor
                    line={line}
                    members={members}
                    groups={groups}
                    plans={plansForGroup(line.groupId)}
                    lineIssue={lineIssues[idx]}
                    onChange={(next) => updateLine(line.key, next)}
                    onRemove={() => removeLine(line.key)}
                    canRemove={lines.length > 1}
                  />
                </fieldset>
              ))}
              <button
                type="button"
                className="btn btn-ghost btn-block-mobile"
                onClick={() => {
                  resetTransientState();
                  setLines((p) => [...p, newEnrollmentLine()]);
                }}
              >
                + Ajouter un élève
              </button>
              <FormActions sticky>
                {missingSummary.length > 0 ? (
                  <p className="text-xs font-medium text-[var(--muted-foreground)]">
                    Complétez {missingSummary[0]} pour continuer.
                  </p>
                ) : null}
                <button
                  type="button"
                  className="btn btn-primary btn-block-mobile sm:ml-auto"
                  disabled={!linesValid}
                  onClick={() => {
                    setMessage(null);
                    setStep(2);
                  }}
                >
                  Suivant : offre
                </button>
              </FormActions>
            </section>
          )}

          {step === 2 && (
            <section className="panel space-y-4 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary)]">2. Offre</p>
                <h2 ref={activeStepHeadingRef} tabIndex={-1} className="mt-1 text-lg font-semibold outline-none">
                  Appliquer une réduction
                </h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {selectedCount >= 2
                    ? "Plusieurs inscriptions dans ce devis: choisissez une offre famille si elle s'applique."
                    : "Étape optionnelle: passez directement au devis s'il n'y a aucune remise."}
                </p>
              </div>
              <select
                className="field"
                value={offerId}
                onChange={(e) => {
                  resetTransientState();
                  setOfferId(e.target.value);
                }}
              >
                <option value="">Aucune offre</option>
                {offers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} — {getOfferKindLabel(o.kind as OfferKind)}
                  </option>
                ))}
              </select>
              {selectedOffer && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-3 text-sm shadow-[var(--shadow-panel)]">
                  <p className="font-medium text-[var(--foreground)]">{selectedOffer.name}</p>
                  <p className="text-xs text-[var(--primary)]">{getOfferKindLabel(selectedOffer.kind)}</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {formatOfferRulesSummary(selectedOffer)}
                  </p>
                  {offerHint && (
                    <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">{offerHint}</p>
                  )}
                </div>
              )}
              <Link href="/offers" className="text-sm text-[var(--primary)] hover:underline">
                Gérer les offres
              </Link>
              <FormActions sticky>
                <button
                  type="button"
                  className="btn btn-ghost btn-block-mobile"
                  onClick={() => {
                    setMessage(null);
                    setStep(1);
                  }}
                >
                  Retour
                </button>
                <button type="button" className="btn btn-primary btn-block-mobile" disabled={loading} onClick={fetchQuote}>
                  {loading ? "Calcul…" : "Calculer le devis"}
                </button>
              </FormActions>
            </section>
          )}

          {step === 3 && quote ? (
            <EnrollmentQuotePanel
              quote={quote}
              lines={lines}
              quotePaidCents={quotePaidCents}
              loading={loading}
              completed={completed}
              headingRef={activeStepHeadingRef}
              onBack={() => {
                setMessage(null);
                setStep(2);
              }}
              onPaymentChange={updateQuoteLinePayment}
            />
          ) : null}

          <details className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 shadow-[var(--shadow-panel)]">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-[var(--foreground)]">
              Règle de paiement
            </summary>
            <div className="space-y-1 border-t border-[var(--border)] py-3 text-sm leading-relaxed text-[var(--muted-foreground)]">
              <p>Le paiement règle la dette de la formule — il n&apos;ajoute pas de séances en plus.</p>
              <p>Pour 2 mois, choisissez une formule 2 mois ou faites un renouvellement.</p>
            </div>
          </details>
        </div>

        <div className="xl:sticky xl:top-[5.5rem]">
          <EnrollmentSummarySidebar
            step={step}
            lineSummaries={lineSummaries}
            missingSummary={missingSummary}
            offerName={selectedOffer?.name ?? "Aucune"}
            quoteTotalLabel={quote ? formatMoney(quote.totalFinalCents) : "À calculer"}
            quotePaidLabel={quote ? formatMoney(quotePaidCents) : "À calculer"}
            quoteBalanceLabel={quote ? formatMoney(quoteBalanceCents) : "À calculer"}
            hasQuote={Boolean(quote)}
            hasBalanceDue={quoteBalanceCents > 0}
          />
        </div>
      </div>
    </form>
  );
}
