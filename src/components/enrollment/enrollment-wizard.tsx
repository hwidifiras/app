"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FieldControl } from "@/components/ui/field-control";
import { FormActions, FormField } from "@/components/ui/form-layout";
import { ReceptionInfoCard } from "@/components/ui/reception-info-card";
import type { OfferLike } from "@/lib/offer-display";
import {
  formatOfferRulesSummary,
  getOfferEnrollmentHint,
  getOfferKindLabel,
} from "@/lib/offer-display";
import { formatPaymentPrefill } from "@/lib/subscription-billing";
import type { OfferKind } from "@prisma/client";

type MemberType = "ADULT" | "KID" | "NOT_SPECIFIED";
type GroupType = "KIDS" | "ADULTS";
type MemberOption = { id: string; firstName: string; lastName: string; phone: string; memberType: MemberType };
type GroupOption = {
  id: string;
  name: string;
  sportId: string;
  sportName: string;
  groupType: GroupType;
  capacity: number;
  activeMembers: number;
};
type PlanOption = {
  id: string;
  name: string;
  price: number;
  sportId: string;
  sportName: string;
};
type OfferOption = OfferLike;

type LineState = {
  key: string;
  mode: "existing" | "new";
  memberId: string;
  newFirstName: string;
  newLastName: string;
  newPhone: string;
  memberType: MemberType;
  parentName: string;
  parentPhone: string;
  parentAddress: string;
  groupId: string;
  planId: string;
  paymentCents: string;
  paymentMethod: string;
};

type QuoteData = {
  lines: Array<{
    lineIndex: number;
    memberName: string;
    groupName: string;
    planName: string;
    sportName: string;
    listPriceCents: number;
    discountCents: number;
    finalAmountCents: number;
    reusesExistingSubscription: boolean;
    warnings: string[];
    blocked: boolean;
  }>;
  offerName: string | null;
  totalFinalCents: number;
  totalDiscountCents: number;
  blocked: boolean;
  warnings: string[];
};

function formatEur(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function isMemberAllowedInGroupType(groupType: GroupType, memberType: MemberType) {
  if (memberType === "NOT_SPECIFIED") return true;
  return groupType === "KIDS" ? memberType === "KID" : memberType === "ADULT";
}

function memberTypeLabel(memberType: MemberType) {
  if (memberType === "KID") return "enfant";
  if (memberType === "ADULT") return "adulte";
  return "non precise";
}

function groupTypeLabel(groupType: GroupType) {
  return groupType === "KIDS" ? "enfants" : "adultes";
}

function lineMemberType(line: LineState, members: MemberOption[]): MemberType | null {
  if (line.mode === "new") return line.memberType;
  if (!line.memberId) return null;
  return members.find((member) => member.id === line.memberId)?.memberType ?? null;
}

function lineCompatibilityIssue(line: LineState, members: MemberOption[], groups: GroupOption[]) {
  if (!line.groupId) return null;
  const group = groups.find((item) => item.id === line.groupId);
  const memberType = lineMemberType(line, members);
  if (!group || !memberType || isMemberAllowedInGroupType(group.groupType, memberType)) {
    return null;
  }
  return `Type incompatible: membre ${memberTypeLabel(memberType)} avec groupe ${groupTypeLabel(group.groupType)}.`;
}

function newLine(memberId = ""): LineState {
  return {
    key: crypto.randomUUID(),
    mode: "existing",
    memberId,
    newFirstName: "",
    newLastName: "",
    newPhone: "",
    memberType: "NOT_SPECIFIED",
    parentName: "",
    parentPhone: "",
    parentAddress: "",
    groupId: "",
    planId: "",
    paymentCents: "",
    paymentMethod: "CASH",
  };
}

export function EnrollmentWizard({
  initialMemberId = "",
  initialOfferId = "",
  initialStep = 1,
}: {
  initialMemberId?: string;
  initialOfferId?: string;
  initialStep?: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep >= 2 && initialStep <= 3 ? initialStep : 1);
  const [lines, setLines] = useState<LineState[]>([newLine(initialMemberId)]);
  const [offerId, setOfferId] = useState(initialOfferId);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [offers, setOffers] = useState<OfferOption[]>([]);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/members").then((r) => r.json()),
      fetch("/api/groups").then((r) => r.json()),
      fetch("/api/subscription-plans").then((r) => r.json()),
      fetch("/api/offers").then((r) => r.json()),
    ]).then(([m, g, p, o]) => {
      setMembers(
        (m.data ?? []).map((x: Record<string, unknown>) => ({
          id: x.id as string,
          firstName: x.firstName as string,
          lastName: x.lastName as string,
          phone: x.phone as string,
          memberType: (x.memberType as MemberType | undefined) ?? "NOT_SPECIFIED",
        })),
      );
      setGroups(
        (g.data ?? []).map((x: Record<string, unknown>) => ({
          id: x.id as string,
          name: x.name as string,
          sportId: x.sportId as string,
          sportName: (x.sport as { name: string })?.name ?? "",
          groupType: (x.groupType as GroupType | undefined) ?? "ADULTS",
          capacity: x.capacity as number,
          activeMembers: (x.activeMembers as number) ?? (x._count as { members: number })?.members ?? 0,
        })),
      );
      setPlans(
        (p.data ?? []).map((x: Record<string, unknown>) => ({
          id: x.id as string,
          name: x.name as string,
          price: x.price as number,
          sportId: x.sportId as string,
          sportName: (x.sport as { name: string })?.name ?? "",
        })),
      );
      setOffers(o.data ?? []);
    });
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
    const res = await fetch("/api/enrollment/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    const data = await res.json() as {
      data?: {
        memberIds: string[];
      };
      error?: string;
    };
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Erreur inscription");
      return;
    }

    const memberIds = data.data?.memberIds ?? [];
    setCompleted(true);
    setMessage("Inscription confirmée.");
    router.replace(memberIds[0] ? `/members/${memberIds[0]}` : "/members");
    router.refresh();
  }

  function resetTransientState() {
    setMessage(null);
    setQuote(null);
    setCompleted(false);
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
          (l.memberType !== "KID" || (l.parentName && l.parentPhone)))),
  );
  const linesValid = linesComplete && lineIssues.every((issue) => !issue);

  return (
    <form onSubmit={applyEnrollment} className="space-y-6 pb-4 lg:pb-0">
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

      <ReceptionInfoCard title="À retenir" variant="info">
        <p>Le paiement règle la dette de la formule — il n&apos;ajoute pas de séances en plus.</p>
        <p>Pour 2 mois, choisissez une formule 2 mois ou faites un renouvellement.</p>
      </ReceptionInfoCard>

      <div className="enrollment-stepper grid grid-cols-3 gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2 shadow-[var(--shadow-panel)]">
        {["Élèves", "Offre", "Devis"].map((label, index) => {
          const itemStep = index + 1;
          const active = step === itemStep;
          const done = step > itemStep;
          return (
            <div
              key={label}
              aria-current={active ? "step" : undefined}
              className={`rounded-xl border px-2 py-2 text-center text-xs font-bold transition ${
                active
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-sm"
                  : done
                    ? "border-[var(--primary)]/25 bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "border-transparent bg-[var(--surface-raised)] text-[var(--muted-foreground)]"
              }`}
            >
              <span className="block text-[0.62rem] opacity-80">{done ? "Terminée" : `Étape ${itemStep}`}</span>
              {label}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <section className="panel space-y-4 p-5">
          <div>
            <h2 className="text-lg font-semibold">Élèves et cours</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Ajoutez une ligne par élève, puis choisissez son groupe et sa formule.
            </p>
          </div>
          {lines.map((line, idx) => (
            <fieldset key={line.key} className="enrollment-fieldset rounded-lg border border-[var(--border)] p-3 sm:p-4">
              <legend className="px-1 text-sm font-medium">Ligne {idx + 1}</legend>
              <LineEditor
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
              setLines((p) => [...p, newLine()]);
            }}
          >
            + Ajouter un élève
          </button>
          <FormActions sticky>
            <button
              type="button"
              className="btn btn-primary btn-block-mobile sm:ml-auto"
              disabled={!linesValid}
              onClick={() => {
                setMessage(null);
                setStep(2);
              }}
            >
              Suivant : offres
            </button>
          </FormActions>
        </section>
      )}

      {step === 2 && (
        <section className="panel space-y-4 p-5">
          <h2 className="text-lg font-semibold">Réduction éventuelle</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            {selectedCount >= 2
              ? "Plusieurs inscriptions dans ce devis — un forfait famille peut s'appliquer."
              : "Réduction optionnelle (%, montant fixe, 2e discipline…)."}
          </p>
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
            <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/30 p-3 text-sm">
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
              {loading ? "Calcul…" : "Voir le devis"}
            </button>
          </FormActions>
        </section>
      )}

      {step === 3 && quote && (
        <section className="panel space-y-4 p-5">
          <div>
            <h2 className="text-lg font-semibold">Vérification et paiement</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Contrôlez chaque inscription et le montant initial avant de confirmer.
            </p>
          </div>
          {quote.offerName && <p className="text-sm text-green-700">Offre : {quote.offerName}</p>}
          <ul className="space-y-3 text-sm">
            {quote.lines.map((l) => (
              <li key={l.lineIndex} className="rounded-lg border p-3">
                <p className="font-medium">{l.memberName}</p>
                <p>
                  {l.groupName} — {l.planName} ({l.sportName})
                </p>
                <p>
                  {formatEur(l.finalAmountCents)}
                  {l.discountCents > 0 && (
                    <span className="text-green-700">
                      {" "}
                      (−{formatEur(l.discountCents)} · catalogue {formatEur(l.listPriceCents)})
                    </span>
                  )}
                </p>
                {l.discountCents > 0 && quote.offerName && (
                  <ReceptionInfoCard variant="success" className="mt-2">
                    <p className="font-semibold">Offre « {quote.offerName} »</p>
                    <p>
                      Nouvel abonnement à {formatEur(l.finalAmountCents)} — le paiement ci-dessous est prérempli.
                    </p>
                  </ReceptionInfoCard>
                )}
                {l.reusesExistingSubscription && l.discountCents === 0 && (
                  <ReceptionInfoCard variant="warning" className="mt-2">
                    <p className="font-semibold">Même abonnement réutilisé</p>
                    <p>Pas de nouvelles séances — ajout d&apos;un cours ou paiement du solde uniquement.</p>
                  </ReceptionInfoCard>
                )}
                {l.warnings.length > 0 && (
                  <p className="mt-1 text-xs text-red-600">{l.warnings.join(" • ")}</p>
                )}
                {l.blocked && (
                  <p className="mt-1 text-xs font-medium text-red-600">Cette ligne est bloquée.</p>
                )}
                <label className="mt-2 block text-sm">
                  <span className="font-medium">
                    {l.reusesExistingSubscription ? "Paiement complémentaire (€)" : "Paiement initial (€)"}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--muted-foreground)]">
                    Max {formatEur(l.finalAmountCents)} pour cette période
                  </span>
                  <FieldControl suffix="€" className="mt-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      className="field pr-10"
                      value={lines[l.lineIndex]?.paymentCents ?? ""}
                      onChange={(e) => {
                        setMessage(null);
                        setLines((prev) =>
                          prev.map((row, i) =>
                            i === l.lineIndex ? { ...row, paymentCents: e.target.value } : row,
                          ),
                        );
                      }}
                    />
                  </FieldControl>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-lg font-semibold">Total : {formatEur(quote.totalFinalCents)}</p>
          {quote.warnings.length > 0 && (
            <FeedbackMessage variant="error" message={quote.warnings.join(" • ")} />
          )}
          <FormActions sticky>
            <button
              type="button"
              className="btn btn-ghost btn-block-mobile"
              onClick={() => {
                setMessage(null);
                setStep(2);
              }}
            >
              Retour
            </button>
            <button type="submit" className="btn btn-primary btn-block-mobile" disabled={loading || completed || quote.blocked}>
              {loading ? "Inscription…" : "Confirmer"}
            </button>
          </FormActions>
        </section>
      )}
    </form>
  );
}

function LineEditor({
  line,
  members,
  groups,
  plans,
  lineIssue,
  onChange,
  onRemove,
  canRemove,
}: {
  line: LineState;
  members: MemberOption[];
  groups: GroupOption[];
  plans: PlanOption[];
  lineIssue?: string | null;
  onChange: (l: LineState) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className={`rounded-xl border px-3 py-2 text-center font-semibold ${line.mode === "existing" ? "enrollment-mode-active" : "enrollment-mode-inactive"}`}>
          <input
            type="radio"
            className="sr-only"
            checked={line.mode === "existing"}
            onChange={() => onChange({ ...line, mode: "existing" })}
          />
          Existant
        </label>
        <label className={`rounded-xl border px-3 py-2 text-center font-semibold ${line.mode === "new" ? "enrollment-mode-active" : "enrollment-mode-inactive"}`}>
          <input
            type="radio"
            className="sr-only"
            checked={line.mode === "new"}
            onChange={() => onChange({ ...line, mode: "new" })}
          />
          Nouveau
        </label>
      </div>
      {line.mode === "existing" ? (
        <FormField label="Membre existant" htmlFor={`${line.key}-member`}>
          <select
            id={`${line.key}-member`}
            className="field"
            value={line.memberId}
            onChange={(e) => onChange({ ...line, memberId: e.target.value })}
          >
            <option value="">Sélectionner un membre</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.firstName} {m.lastName}
              </option>
            ))}
          </select>
        </FormField>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          <FormField label="Prénom" htmlFor={`${line.key}-first-name`}>
            <input
              id={`${line.key}-first-name`}
              className="field"
              value={line.newFirstName}
              onChange={(e) => onChange({ ...line, newFirstName: e.target.value })}
            />
          </FormField>
          <FormField label="Nom" htmlFor={`${line.key}-last-name`}>
            <input
              id={`${line.key}-last-name`}
              className="field"
              value={line.newLastName}
              onChange={(e) => onChange({ ...line, newLastName: e.target.value })}
            />
          </FormField>
          <FormField label="Téléphone" htmlFor={`${line.key}-phone`}>
            <input
              id={`${line.key}-phone`}
              className="field"
              inputMode="tel"
              value={line.newPhone}
              onChange={(e) => onChange({ ...line, newPhone: e.target.value })}
            />
          </FormField>
          <FormField label="Type de membre" htmlFor={`${line.key}-type`} className="sm:col-span-3">
            <select
              id={`${line.key}-type`}
              className="field"
              value={line.memberType}
              onChange={(e) =>
                onChange({ ...line, memberType: e.target.value as LineState["memberType"] })
              }
            >
              <option value="NOT_SPECIFIED">Type non précisé</option>
              <option value="ADULT">Adulte</option>
              <option value="KID">Enfant</option>
            </select>
          </FormField>
          {line.memberType === "KID" && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 sm:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Informations parent / tuteur
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <FormField label="Nom du parent" htmlFor={`${line.key}-parent-name`}>
                  <input
                    id={`${line.key}-parent-name`}
                    className="field"
                    value={line.parentName}
                    onChange={(e) => onChange({ ...line, parentName: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Téléphone du parent" htmlFor={`${line.key}-parent-phone`}>
                  <input
                    id={`${line.key}-parent-phone`}
                    className="field"
                    inputMode="tel"
                    value={line.parentPhone}
                    onChange={(e) => onChange({ ...line, parentPhone: e.target.value })}
                    required
                  />
                </FormField>
                <FormField
                  label="Adresse du parent"
                  htmlFor={`${line.key}-parent-address`}
                  hint="Optionnelle"
                  className="sm:col-span-2"
                >
                  <input
                    id={`${line.key}-parent-address`}
                    className="field"
                    value={line.parentAddress}
                    onChange={(e) => onChange({ ...line, parentAddress: e.target.value })}
                  />
                </FormField>
              </div>
            </div>
          )}
        </div>
      )}
      <FormField label="Groupe" htmlFor={`${line.key}-group`}>
        <select
          id={`${line.key}-group`}
          className="field"
          value={line.groupId}
          onChange={(e) => onChange({ ...line, groupId: e.target.value, planId: "" })}
        >
          <option value="">Sélectionner un groupe</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} — {g.sportName} · {groupTypeLabel(g.groupType)} ({g.activeMembers}/{g.capacity})
            </option>
          ))}
        </select>
      </FormField>
      {lineIssue ? <FeedbackMessage variant="error" message={lineIssue} /> : null}
      <FormField label="Formule" htmlFor={`${line.key}-plan`}>
        <select
          id={`${line.key}-plan`}
          className="field"
          value={line.planId}
          onChange={(e) => onChange({ ...line, planId: e.target.value })}
          disabled={!line.groupId}
        >
          <option value="">Sélectionner une formule</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {(p.price / 100).toFixed(2)} €
            </option>
          ))}
        </select>
      </FormField>
      {canRemove && (
        <button type="button" className="btn btn-ghost btn-block-mobile min-h-11 text-red-600 sm:w-auto" onClick={onRemove}>
          Supprimer cette ligne
        </button>
      )}
    </div>
  );
}
