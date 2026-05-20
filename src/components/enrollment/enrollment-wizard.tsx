"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions } from "@/components/ui/form-layout";

type MemberOption = { id: string; firstName: string; lastName: string; phone: string };
type GroupOption = {
  id: string;
  name: string;
  sportId: string;
  sportName: string;
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
type OfferOption = { id: string; name: string; kind: string };

type LineState = {
  key: string;
  mode: "existing" | "new";
  memberId: string;
  newFirstName: string;
  newLastName: string;
  newPhone: string;
  memberType: "ADULT" | "KID" | "NOT_SPECIFIED";
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

function newLine(): LineState {
  return {
    key: crypto.randomUUID(),
    mode: "existing",
    memberId: "",
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

export function EnrollmentWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [lines, setLines] = useState<LineState[]>([newLine()]);
  const [offerId, setOfferId] = useState("");
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [offers, setOffers] = useState<OfferOption[]>([]);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/members").then((r) => r.json()),
      fetch("/api/groups").then((r) => r.json()),
      fetch("/api/subscription-plans").then((r) => r.json()),
      fetch("/api/offers").then((r) => r.json()),
    ]).then(([m, g, p, o]) => {
      setMembers(m.data ?? []);
      setGroups(
        (g.data ?? []).map((x: Record<string, unknown>) => ({
          id: x.id as string,
          name: x.name as string,
          sportId: x.sportId as string,
          sportName: (x.sport as { name: string })?.name ?? "",
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
    setStep(3);
  }

  async function applyEnrollment(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/enrollment/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildPayload()),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Erreur inscription");
      return;
    }
    router.push(`/members/${data.data.memberIds[0]}`);
    router.refresh();
  }

  function plansForGroup(groupId: string) {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return [];
    return plans.filter((p) => p.sportId === g.sportId);
  }

  const selectedCount = useMemo(
    () => lines.filter((l) => l.mode === "existing" && l.memberId).length,
    [lines],
  );

  const linesValid = lines.every(
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

  return (
    <form onSubmit={applyEnrollment} className="space-y-6">
      {message && <FeedbackMessage variant="error" message={message} />}

      <div className="enrollment-stepper grid grid-cols-3 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-2 shadow-sm">
        {["Élèves", "Offre", "Devis"].map((label, index) => {
          const itemStep = index + 1;
          const active = step === itemStep;
          const done = step > itemStep;
          return (
            <div
              key={label}
              className={`rounded-xl px-2 py-2 text-center text-xs font-bold ${
                active || done
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--surface-soft)] text-[var(--muted-foreground)]"
              }`}
            >
              <span className="block text-[0.62rem] opacity-80">Étape {itemStep}</span>
              {label}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <section className="panel space-y-4 p-5">
          <h2 className="text-lg font-semibold">Élèves et cours</h2>
          {lines.map((line, idx) => (
            <fieldset key={line.key} className="enrollment-fieldset rounded-2xl border border-[var(--border)] p-3 sm:p-4">
              <legend className="px-1 text-sm font-medium">Ligne {idx + 1}</legend>
              <LineEditor
                line={line}
                members={members}
                groups={groups}
                plans={plansForGroup(line.groupId)}
                onChange={(next) =>
                  setLines((prev) => prev.map((l) => (l.key === line.key ? next : l)))
                }
                onRemove={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                canRemove={lines.length > 1}
              />
            </fieldset>
          ))}
          <button
            type="button"
            className="btn btn-ghost btn-block-mobile"
            onClick={() => setLines((p) => [...p, newLine()])}
          >
            + Ajouter un élève
          </button>
          <FormActions sticky>
            <button
              type="button"
              className="btn btn-primary btn-block-mobile sm:ml-auto"
              disabled={!linesValid}
              onClick={() => setStep(2)}
            >
              Suivant : offres
            </button>
          </FormActions>
        </section>
      )}

      {step === 2 && (
        <section className="panel space-y-4 p-5">
          <h2 className="text-lg font-semibold">Offre</h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            {selectedCount >= 2
              ? "Plusieurs élèves — offre famille possible."
              : "Réduction optionnelle."}
          </p>
          <select
            className="field"
            value={offerId}
            onChange={(e) => setOfferId(e.target.value)}
          >
            <option value="">Aucune offre</option>
            {offers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <Link href="/offers" className="text-sm text-[var(--primary)] hover:underline">
            Créer une offre
          </Link>
          <FormActions sticky>
            <button type="button" className="btn btn-ghost btn-block-mobile" onClick={() => setStep(1)}>
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
          <h2 className="text-lg font-semibold">Confirmation</h2>
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
                    <span className="text-green-700"> (−{formatEur(l.discountCents)})</span>
                  )}
                </p>
                {l.warnings.length > 0 && (
                  <p className="mt-1 text-xs text-red-600">{l.warnings.join(" • ")}</p>
                )}
                {l.blocked && (
                  <p className="mt-1 text-xs font-medium text-red-600">Cette ligne est bloquée.</p>
                )}
                <label className="mt-2 block">
                  {l.reusesExistingSubscription ? "Paiement complémentaire (€)" : "Paiement initial (€)"}
                  <input
                    type="text"
                  className="field mt-1"
                    value={lines[l.lineIndex]?.paymentCents ?? ""}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((row, i) =>
                          i === l.lineIndex ? { ...row, paymentCents: e.target.value } : row,
                        ),
                      )
                    }
                  />
                </label>
              </li>
            ))}
          </ul>
          <p className="text-lg font-semibold">Total : {formatEur(quote.totalFinalCents)}</p>
          {quote.warnings.length > 0 && (
            <FeedbackMessage variant="error" message={quote.warnings.join(" • ")} />
          )}
          <FormActions sticky>
            <button type="button" className="btn btn-ghost btn-block-mobile" onClick={() => setStep(2)}>
              Retour
            </button>
            <button type="submit" className="btn btn-primary btn-block-mobile" disabled={loading || quote.blocked}>
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
  onChange,
  onRemove,
  canRemove,
}: {
  line: LineState;
  members: MemberOption[];
  groups: GroupOption[];
  plans: PlanOption[];
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
        <select
          className="field"
          value={line.memberId}
          onChange={(e) => onChange({ ...line, memberId: e.target.value })}
        >
          <option value="">Élève</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.firstName} {m.lastName}
            </option>
          ))}
        </select>
      ) : (
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            placeholder="Prénom"
            className="field"
            value={line.newFirstName}
            onChange={(e) => onChange({ ...line, newFirstName: e.target.value })}
          />
          <input
            placeholder="Nom"
            className="field"
            value={line.newLastName}
            onChange={(e) => onChange({ ...line, newLastName: e.target.value })}
          />
          <input
            placeholder="Téléphone"
            className="field"
            value={line.newPhone}
            onChange={(e) => onChange({ ...line, newPhone: e.target.value })}
          />
          <select
            className="field sm:col-span-3"
            value={line.memberType}
            onChange={(e) =>
              onChange({ ...line, memberType: e.target.value as LineState["memberType"] })
            }
          >
            <option value="NOT_SPECIFIED">Type non précisé</option>
            <option value="ADULT">Adulte</option>
            <option value="KID">Enfant</option>
          </select>
          {line.memberType === "KID" && (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 sm:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Informations parent / tuteur
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  placeholder="Nom du parent *"
                  className="field"
                  value={line.parentName}
                  onChange={(e) => onChange({ ...line, parentName: e.target.value })}
                  required
                />
                <input
                  placeholder="Téléphone parent *"
                  className="field"
                  value={line.parentPhone}
                  onChange={(e) => onChange({ ...line, parentPhone: e.target.value })}
                  required
                />
                <input
                  placeholder="Adresse parent (optionnelle)"
                  className="field sm:col-span-2"
                  value={line.parentAddress}
                  onChange={(e) => onChange({ ...line, parentAddress: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
      )}
      <select
        className="field"
        value={line.groupId}
        onChange={(e) => onChange({ ...line, groupId: e.target.value, planId: "" })}
      >
        <option value="">Cours</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name} — {g.sportName} ({g.activeMembers}/{g.capacity})
          </option>
        ))}
      </select>
      <select
        className="field"
        value={line.planId}
        onChange={(e) => onChange({ ...line, planId: e.target.value })}
        disabled={!line.groupId}
      >
        <option value="">Formule</option>
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {(p.price / 100).toFixed(2)} €
          </option>
        ))}
      </select>
      {canRemove && (
        <button type="button" className="btn btn-ghost w-full text-red-600 sm:w-auto" onClick={onRemove}>
          Supprimer
        </button>
      )}
    </div>
  );
}
