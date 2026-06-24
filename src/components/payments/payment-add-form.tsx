"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  Check,
  CheckCircle2,
  CreditCard,
  ReceiptText,
  UserRound,
  Wallet,
} from "lucide-react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FieldControl } from "@/components/ui/field-control";
import { FormActions, FormField, FormGrid, FormSection } from "@/components/ui/form-layout";
import { SubscriptionBillingSummary } from "@/components/ui/reception-info-card";
import { UndoButton } from "@/components/ui/undo-button";
import { useActionHistory } from "@/hooks/use-action-history";
import { cn } from "@/lib/utils";

const METHODS = [
  { value: "CASH", label: "Espèces", icon: <Banknote className="size-4" /> },
  { value: "CARD", label: "Carte bancaire", icon: <CreditCard className="size-4" /> },
  { value: "TRANSFER", label: "Virement", icon: <Wallet className="size-4" /> },
  { value: "CHECK", label: "Chèque", icon: <Banknote className="size-4" /> },
];

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);
}

type SubscriptionRow = {
  id: string;
  memberId: string;
  memberName: string;
  planName: string;
  amount: number;
  totalPaid: number;
};

export function PaymentAddForm({
  subscriptions: initialSubscriptions,
  defaultSubscriptionId,
}: {
  subscriptions: SubscriptionRow[];
  defaultSubscriptionId?: string;
}) {
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const initialSubscriptionId = defaultSubscriptionId ?? initialSubscriptions[0]?.id ?? "";
  const [subscriptionId, setSubscriptionId] = useState(initialSubscriptionId);
  const defaultSubscription = initialSubscriptions.find((row) => row.id === initialSubscriptionId);
  const [memberId, setMemberId] = useState(defaultSubscription?.memberId ?? initialSubscriptions[0]?.memberId ?? "");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { push, undoLast, loading: undoLoading, canUndo } = useActionHistory({ enableKeyboard: true });

  const selected = subscriptions.find((s) => s.id === subscriptionId);
  const remaining = selected ? selected.amount - selected.totalPaid : 0;
  const amountNum = Math.round(parseFloat(amount.replace(",", ".")) * 100) || 0;
  const wouldExceed = Boolean(selected && amountNum > remaining);
  const balanceAfter = remaining - amountNum;
  const displayBalanceAfter = Math.max(0, balanceAfter);
  const members = useMemo(
    () =>
      Array.from(
        new Map(
          subscriptions.map((subscription) => [
            subscription.memberId,
            { id: subscription.memberId, name: subscription.memberName },
          ]),
        ).values(),
      ).sort((a, b) => a.name.localeCompare(b.name, "fr")),
    [subscriptions],
  );
  const memberSubscriptions = subscriptions.filter((subscription) => subscription.memberId === memberId);

  const successMessage = useMemo(
    () => (message?.startsWith("Paiement enregistré") ? message : null),
    [message],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subscriptionId || amountNum <= 0) return;
    if (wouldExceed) {
      setMessage("Le montant dépasse le solde restant dû.");
      return;
    }

    setLoading(true);
    setMessage(null);

    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberSubscriptionId: subscriptionId,
        amount: amountNum,
        paymentDate: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        paymentMethod: method,
        notes: notes.trim() || undefined,
      }),
    });

    const json = (await res.json()) as {
      data?: { id: string; amount: number; memberSubscriptionId: string };
      error?: string;
    };
    setLoading(false);

    if (!res.ok) {
      setMessage(json.error ?? "Erreur lors de l'enregistrement du paiement.");
      return;
    }

    const paymentId = json.data?.id;
    const paidAmount = json.data?.amount ?? amountNum;
    const paidSubscriptionId = json.data?.memberSubscriptionId ?? subscriptionId;

    setSubscriptions((current) =>
      current.map((row) =>
        row.id === paidSubscriptionId
          ? { ...row, totalPaid: row.totalPaid + paidAmount }
          : row,
      ),
    );

    if (paymentId) {
      push({
        scope: "payment",
        label: "Encaissement",
        undo: async () => {
          const deleteRes = await fetch("/api/payments", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paymentId, correctionReason: "Annulation immediate apres encaissement" }),
          });
          const deleteJson = (await deleteRes.json()) as { error?: string };
          if (!deleteRes.ok) {
            setMessage(deleteJson.error ?? "Impossible d'annuler le paiement.");
            return false;
          }

          setSubscriptions((current) =>
            current.map((row) =>
              row.id === paidSubscriptionId
                ? { ...row, totalPaid: Math.max(0, row.totalPaid - paidAmount) }
                : row,
            ),
          );
          setMessage("Dernier paiement annulé.");
          return true;
        },
      });
    }

    setAmount("");
    setNotes("");
    setMessage("Paiement enregistré avec succès.");
  }

  function selectMember(nextMemberId: string) {
    setMemberId(nextMemberId);
    const firstSubscription = subscriptions.find((subscription) => subscription.memberId === nextMemberId);
    setSubscriptionId(firstSubscription?.id ?? "");
    setAmount("");
    setMessage(null);
  }

  function selectSubscription(nextSubscriptionId: string) {
    setSubscriptionId(nextSubscriptionId);
    setAmount("");
    setMessage(null);
  }

  function fillRemainingBalance() {
    if (remaining <= 0) return;
    setAmount((remaining / 100).toFixed(2));
    setMessage(null);
  }

  return (
    <form onSubmit={handleSubmit}>
      {message && (
        <FeedbackMessage
          message={message}
          className="mb-4"
          variant={successMessage ? "success" : message.startsWith("Dernier paiement annulé") ? "success" : undefined}
        />
      )}

      {successMessage && canUndo ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <UndoButton
            onClick={() => undoLast()}
            disabled={undoLoading || loading}
            label="Annuler ce paiement"
            title="Annuler le dernier encaissement (Ctrl+Z)"
          />
          <Link href="/payments" className="text-sm font-medium text-[var(--primary)] hover:underline">
            Voir l&apos;historique
          </Link>
        </div>
      ) : null}

      {subscriptions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 py-10 text-center shadow-[var(--shadow-panel)]">
          <CheckCircle2 className="mx-auto size-9 text-[var(--success)]" />
          <h2 className="mt-3 text-base font-semibold">Aucun solde à encaisser</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted-foreground)]">
            Aucun abonnement actif ne présente de montant restant dû.
          </p>
          <Link href="/subscriptions" className="btn btn-secondary mt-4">
            Voir les abonnements
          </Link>
        </div>
      ) : (
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <FormSection
              title="1. Dossier"
              description="Choisissez le membre et le solde à régler."
            >
              <FormGrid>
                <FormField label="Membre *" htmlFor="member">
                  <FieldControl icon={<UserRound className="size-4" />}>
                    <select
                      id="member"
                      value={memberId}
                      onChange={(event) => selectMember(event.target.value)}
                      required
                      className="field has-leading-icon"
                    >
                      <option value="">Sélectionner un membre</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name}
                        </option>
                      ))}
                    </select>
                  </FieldControl>
                </FormField>

                <FormField label="Abonnement à régler *" htmlFor="subscription">
                  <select
                    id="subscription"
                    value={subscriptionId}
                    onChange={(event) => selectSubscription(event.target.value)}
                    required
                    disabled={!memberId}
                    className="field"
                  >
                    <option value="">Sélectionner un abonnement</option>
                    {memberSubscriptions.map((subscription) => (
                      <option key={subscription.id} value={subscription.id}>
                        {subscription.planName} · reste {formatCurrency(subscription.amount - subscription.totalPaid)}
                      </option>
                    ))}
                  </select>
                </FormField>
              </FormGrid>

              {selected ? (
                <div className="mt-4">
                  <SubscriptionBillingSummary
                    amountDueCents={selected.amount}
                    totalPaidCents={selected.totalPaid}
                  />
                </div>
              ) : null}
            </FormSection>

            <FormSection
              title="2. Montant"
              description="Saisissez le versement remis, sans dépasser le reste dû."
            >
              <FormField label="Montant encaissé (€) *" htmlFor="amount">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <FieldControl suffix="€" className="flex-1">
                    <input
                      id="amount"
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0.01"
                      max={selected ? (remaining / 100).toFixed(2) : undefined}
                      required
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      className={`field pr-10 text-lg font-semibold tabular-nums ${wouldExceed ? "border-[var(--danger)] ring-1 ring-[var(--danger)]" : ""}`}
                      placeholder="0,00"
                    />
                  </FieldControl>
                  <button
                    type="button"
                    onClick={fillRemainingBalance}
                    disabled={!selected || remaining <= 0}
                    className="btn btn-secondary whitespace-nowrap sm:min-w-36"
                  >
                    Solder {selected ? formatCurrency(remaining) : ""}
                  </button>
                </div>
                {selected ? (
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-xs">
                    <span className="text-[var(--muted-foreground)]">
                      Maximum autorisé: <strong className="text-[var(--foreground)]">{formatCurrency(remaining)}</strong>
                    </span>
                    {wouldExceed ? (
                      <span className="font-semibold text-[var(--danger)]">Le montant dépasse le reste dû.</span>
                    ) : amountNum > 0 ? (
                      <span className="font-medium text-[var(--success)]">
                        Solde après paiement: {formatCurrency(displayBalanceAfter)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </FormField>
            </FormSection>

            <FormSection
              title="3. Règlement"
              description="La date et le moyen de paiement apparaîtront dans l'historique."
            >
              <FormField label="Moyen de paiement *">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {METHODS.map((paymentMethod) => (
                    <button
                      key={paymentMethod.value}
                      type="button"
                      onClick={() => setMethod(paymentMethod.value)}
                      className={cn(
                        "relative flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-semibold transition",
                        method === paymentMethod.value
                          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] ring-1 ring-[var(--primary)]/20"
                          : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-soft)]",
                      )}
                      aria-pressed={method === paymentMethod.value}
                    >
                      {method === paymentMethod.value ? (
                        <Check className="absolute right-2 top-2 size-3.5" />
                      ) : null}
                      {paymentMethod.icon}
                      {paymentMethod.label}
                    </button>
                  ))}
                </div>
              </FormField>

              <FormGrid className="mt-4">
                <FormField label="Date du règlement" htmlFor="paymentDate">
                  <input
                    id="paymentDate"
                    type="date"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                    className="field"
                  />
                </FormField>
                <FormField
                  label="Référence ou note"
                  htmlFor="notes"
                  hint="Facultatif: numéro de chèque, référence de virement ou remarque."
                >
                  <input
                    id="notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="field"
                    placeholder="Ex: chèque n° 1234"
                  />
                </FormField>
              </FormGrid>
            </FormSection>
          </div>

          <aside className="lg:sticky lg:top-20 lg:col-span-4">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)]">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                  <ReceiptText className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">À encaisser</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Vérification avant validation</p>
                </div>
              </div>

              <dl className="mt-4 divide-y divide-[var(--border)] text-sm">
                <div className="flex items-start justify-between gap-3 py-2.5">
                  <dt className="text-[var(--muted-foreground)]">Membre</dt>
                  <dd className="text-right font-medium">{selected?.memberName ?? "Non sélectionné"}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 py-2.5">
                  <dt className="text-[var(--muted-foreground)]">Abonnement</dt>
                  <dd className="text-right font-medium">{selected?.planName ?? "Non sélectionné"}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 py-2.5">
                  <dt className="text-[var(--muted-foreground)]">Reste actuel</dt>
                  <dd className="text-right font-semibold">{selected ? formatCurrency(remaining) : "—"}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 py-2.5">
                  <dt className="text-[var(--muted-foreground)]">Montant reçu</dt>
                  <dd className="text-right text-base font-bold text-[var(--primary)]">
                    {amountNum > 0 ? formatCurrency(amountNum) : "—"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3 py-2.5">
                  <dt className="text-[var(--muted-foreground)]">Solde après</dt>
                  <dd
                    className={cn(
                      "text-right font-bold",
                      wouldExceed
                        ? "text-[var(--danger)]"
                        : displayBalanceAfter > 0
                          ? "text-[var(--danger)]"
                          : "text-[var(--success)]",
                    )}
                  >
                    {wouldExceed
                      ? "Montant invalide"
                      : selected && amountNum > 0
                        ? formatCurrency(displayBalanceAfter)
                        : "—"}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                Cet encaissement réduit le solde de l&apos;abonnement. Il n&apos;ajoute pas de séances.
              </p>
            </div>
          </aside>
        </div>
      )}

      {subscriptions.length > 0 ? <FormActions sticky>
        <button type="button" onClick={() => router.push("/payments")} className="btn btn-ghost btn-block-mobile">
          <ArrowLeft className="size-4" />
          Retour
        </button>
        <button
          type="submit"
          disabled={loading || !subscriptionId || amountNum <= 0 || wouldExceed}
          className="btn btn-primary btn-block-mobile"
        >
          {loading ? (
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {amountNum > 0 ? `Encaisser ${formatCurrency(amountNum)}` : "Encaisser le paiement"}
        </button>
      </FormActions> : null}
    </form>
  );
}
