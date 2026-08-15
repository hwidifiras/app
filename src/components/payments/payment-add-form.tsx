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
  Wallet,
} from "lucide-react";

import { FeedbackMessage } from "@/components/ui/feedback-message";
import { FormActions, FormField, FormGrid, FormSection, FormSectionNav } from "@/components/ui/form-layout";
import { UndoButton } from "@/components/ui/undo-button";
import { PaymentAmountSection } from "@/components/payments/payment-amount-section";
import { PaymentSummaryPanel } from "@/components/payments/payment-summary-panel";
import {
  PaymentSubscriptionSelector,
  type PaymentSubscriptionRow,
} from "@/components/payments/payment-subscription-selector";
import { useActionHistory } from "@/hooks/use-action-history";
import { useIdempotencyIntent } from "@/hooks/use-idempotency-intent";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const METHODS = [
  { value: "CASH", label: "Espèces", icon: <Banknote className="size-4" /> },
  { value: "CARD", label: "Carte bancaire", icon: <CreditCard className="size-4" /> },
  { value: "TRANSFER", label: "Virement", icon: <Wallet className="size-4" /> },
  { value: "CHECK", label: "Chèque", icon: <Banknote className="size-4" /> },
];

export function PaymentAddForm({
  subscriptions: initialSubscriptions,
  defaultSubscriptionId,
  receiptPrintDefault = true,
}: {
  subscriptions: PaymentSubscriptionRow[];
  defaultSubscriptionId?: string;
  receiptPrintDefault?: boolean;
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
  const [lastReceipt, setLastReceipt] = useState<{ id: string; receiptNumber: string } | null>(null);
  const { push, undoLast, loading: undoLoading, canUndo } = useActionHistory({ enableKeyboard: true });
  const paymentIntent = useIdempotencyIntent();

  const selected = subscriptions.find((s) => s.id === subscriptionId);
  const remaining = selected ? selected.amount - selected.totalPaid : 0;
  const amountNum = Math.round(parseFloat(amount.replace(",", ".")) * 100) || 0;
  const wouldExceed = Boolean(selected && amountNum > remaining);
  const balanceAfter = remaining - amountNum;
  const displayBalanceAfter = Math.max(0, balanceAfter);
  const canSubmit = Boolean(subscriptionId && amountNum > 0 && !wouldExceed);
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
    setLastReceipt(null);

    const requestPayload = {
      memberSubscriptionId: subscriptionId,
      amount: amountNum,
      paymentDate: paymentDate ? new Date(paymentDate).toISOString() : undefined,
      paymentMethod: method,
      notes: notes.trim() || undefined,
    };
    let res: Response;
    try {
      res = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": paymentIntent.keyFor(requestPayload),
        },
        body: JSON.stringify(requestPayload),
      });
    } catch {
      setLoading(false);
      setMessage("Connexion interrompue. Réessayez : le même paiement ne sera pas créé deux fois.");
      return;
    }

    const json = (await res.json()) as {
      data?: {
        id: string;
        amount: number;
        memberSubscriptionId: string;
        receipt?: { id: string; receiptNumber: string } | null;
        receiptEmailDelivery?: {
          delivered: boolean;
          email?: string;
          error?: string;
        } | null;
      };
      error?: string;
    };
    setLoading(false);

    if (!res.ok) {
      setMessage(json.error ?? "Erreur lors de l'enregistrement du paiement.");
      return;
    }
    paymentIntent.complete(requestPayload);

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
          const reversalPayload = {
            paymentId,
            correctionReason: "Annulation immediate apres encaissement",
          };
          const deleteRes = await fetch("/api/payments", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": paymentIntent.keyFor(reversalPayload),
            },
            body: JSON.stringify(reversalPayload),
          });
          const deleteJson = (await deleteRes.json()) as { error?: string };
          if (!deleteRes.ok) {
            setMessage(deleteJson.error ?? "Impossible d'annuler le paiement.");
            return false;
          }
          paymentIntent.complete(reversalPayload);

          setSubscriptions((current) =>
            current.map((row) =>
              row.id === paidSubscriptionId
                ? { ...row, totalPaid: Math.max(0, row.totalPaid - paidAmount) }
                : row,
            ),
          );
          setMessage("Dernier paiement annulé.");
          setLastReceipt(null);
          return true;
        },
      });
    }

    setAmount("");
    setNotes("");
    setLastReceipt(json.data?.receipt ?? null);
    const emailDelivery = json.data?.receiptEmailDelivery;
    if (emailDelivery?.delivered) {
      setMessage(`Paiement enregistré avec succès. Recu envoye a ${emailDelivery.email}.`);
    } else if (emailDelivery && !emailDelivery.delivered) {
      setMessage(
        `Paiement enregistré avec succès. Recu cree, email non envoye: ${emailDelivery.error ?? "erreur email"}.`,
      );
    } else {
      setMessage("Paiement enregistré avec succès.");
    }
  }

  function selectMember(nextMemberId: string) {
    setMemberId(nextMemberId);
    const firstSubscription = subscriptions.find((subscription) => subscription.memberId === nextMemberId);
    setSubscriptionId(firstSubscription?.id ?? "");
    setAmount("");
    setMessage(null);
    setLastReceipt(null);
  }

  function selectSubscription(nextSubscriptionId: string) {
    setSubscriptionId(nextSubscriptionId);
    setAmount("");
    setMessage(null);
    setLastReceipt(null);
  }

  function fillRemainingBalance() {
    if (remaining <= 0) return;
    setAmount((remaining / 100).toFixed(2));
    setMessage(null);
  }

  function fillHalfBalance() {
    if (remaining <= 0) return;
    setAmount((Math.ceil(remaining / 2) / 100).toFixed(2));
    setMessage(null);
  }

  function clearAmount() {
    setAmount("");
    setMessage(null);
    setLastReceipt(null);
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
          {lastReceipt && receiptPrintDefault ? (
            <Link href={`/receipts/${lastReceipt.id}`} className="text-sm font-medium text-[var(--primary)] hover:underline">
              Imprimer le recu {lastReceipt.receiptNumber}
            </Link>
          ) : null}
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
        <>
          <FormSectionNav
            items={[
              { href: "#payment-member", label: "Dette" },
              { href: "#payment-amount", label: "Montant reçu" },
              { href: "#payment-method", label: "Mode" },
              { href: "#payment-summary", label: "Confirmer" },
            ]}
            className="mb-4"
          />

          {selected ? (
            <div className="mb-4 grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-panel)] sm:grid-cols-3">
              <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900">
                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-red-600">Reste à encaisser</p>
                <p className="mt-1 text-lg font-black tabular-nums">{formatMoney(remaining)}</p>
              </div>
              <div className="rounded-lg bg-[var(--primary)]/10 px-3 py-2 text-sm text-[var(--primary)]">
                <p className="text-[0.65rem] font-bold uppercase tracking-wide">Montant reçu</p>
                <p className="mt-1 text-lg font-black tabular-nums">{amountNum > 0 ? formatMoney(amountNum) : "0,00 TND"}</p>
              </div>
              <div className="rounded-lg bg-[var(--surface-soft)] px-3 py-2 text-sm">
                <p className="text-[0.65rem] font-bold uppercase tracking-wide text-[var(--muted-foreground)]">Après encaissement</p>
                <p
                  className={cn(
                    "mt-1 text-lg font-black tabular-nums",
                    amountNum > 0 && !wouldExceed && displayBalanceAfter === 0
                      ? "text-[var(--success)]"
                      : wouldExceed
                        ? "text-[var(--danger)]"
                        : "text-[var(--foreground)]",
                  )}
                >
                  {wouldExceed ? "Invalide" : amountNum > 0 ? formatMoney(displayBalanceAfter) : "À calculer"}
                </p>
              </div>
            </div>
          ) : null}

        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-8">
            <PaymentSubscriptionSelector
              members={members}
              memberId={memberId}
              subscriptionId={subscriptionId}
              memberSubscriptions={memberSubscriptions}
              selected={selected}
              remaining={remaining}
              onMemberChange={selectMember}
              onSubscriptionChange={selectSubscription}
            />

            <PaymentAmountSection
              hasSelectedSubscription={Boolean(selected)}
              remaining={remaining}
              amount={amount}
              amountNum={amountNum}
              wouldExceed={wouldExceed}
              displayBalanceAfter={displayBalanceAfter}
              onAmountChange={setAmount}
              onFillRemainingBalance={fillRemainingBalance}
              onFillHalfBalance={fillHalfBalance}
              onClearAmount={clearAmount}
            />

            <FormSection
              id="payment-method"
              title="3. Mode"
              description="Choisissez le moyen de paiement visible dans l'historique."
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

          <PaymentSummaryPanel
            selected={selected}
            remaining={remaining}
            amountNum={amountNum}
            wouldExceed={wouldExceed}
            displayBalanceAfter={displayBalanceAfter}
            canSubmit={canSubmit}
          />
        </div>
        </>
      )}

      {subscriptions.length > 0 ? <FormActions sticky>
        <button type="button" onClick={() => router.push("/payments")} className="btn btn-ghost btn-block-mobile">
          <ArrowLeft className="size-4" />
          Retour
        </button>
        {amountNum <= 0 ? (
          <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-center text-xs font-medium text-[var(--muted-foreground)] md:hidden">
            Saisissez le montant avant d&apos;encaisser.
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading || !canSubmit}
          className={cn("btn btn-primary btn-block-mobile", amountNum <= 0 && "max-md:hidden")}
        >
          {loading ? (
            <span className="inline-block size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {amountNum > 0 ? `Encaisser ${formatMoney(amountNum)}` : "Encaisser le paiement"}
        </button>
      </FormActions> : null}
    </form>
  );
}
