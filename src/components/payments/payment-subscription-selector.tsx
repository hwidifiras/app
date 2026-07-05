import { UserRound } from "lucide-react";

import { FieldControl } from "@/components/ui/field-control";
import { FormField, FormGrid, FormSection } from "@/components/ui/form-layout";
import { SubscriptionBillingSummary } from "@/components/ui/reception-info-card";
import { formatMoney } from "@/lib/money";

export type PaymentSubscriptionRow = {
  id: string;
  memberId: string;
  memberName: string;
  planName: string;
  amount: number;
  totalPaid: number;
};

type PaymentMemberOption = {
  id: string;
  name: string;
};

type PaymentSubscriptionSelectorProps = {
  members: PaymentMemberOption[];
  memberId: string;
  subscriptionId: string;
  memberSubscriptions: PaymentSubscriptionRow[];
  selected: PaymentSubscriptionRow | undefined;
  remaining: number;
  onMemberChange: (memberId: string) => void;
  onSubscriptionChange: (subscriptionId: string) => void;
};

export function PaymentSubscriptionSelector({
  members,
  memberId,
  subscriptionId,
  memberSubscriptions,
  selected,
  remaining,
  onMemberChange,
  onSubscriptionChange,
}: PaymentSubscriptionSelectorProps) {
  return (
    <FormSection
      id="payment-member"
      title="1. Dette"
      description="Choisissez le membre puis l'abonnement qui a encore un solde."
    >
      <FormGrid>
        <FormField label="Membre *" htmlFor="member">
          <FieldControl icon={<UserRound className="size-4" />}>
            <select
              id="member"
              value={memberId}
              onChange={(event) => onMemberChange(event.target.value)}
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
            onChange={(event) => onSubscriptionChange(event.target.value)}
            required
            disabled={!memberId}
            className="field"
          >
            <option value="">Sélectionner un abonnement</option>
            {memberSubscriptions.map((subscription) => (
              <option key={subscription.id} value={subscription.id}>
                {subscription.planName} · reste {formatMoney(subscription.amount - subscription.totalPaid)}
              </option>
            ))}
          </select>
        </FormField>
      </FormGrid>

      {selected ? (
        <div className="mt-4 md:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm">
            <span className="text-[var(--muted-foreground)]">Reste à encaisser</span>
            <strong className="tabular-nums text-[var(--danger)]">{formatMoney(remaining)}</strong>
          </div>
          <a href="#payment-amount" className="btn btn-primary btn-block-mobile mt-2 min-h-11">
            Saisir le montant
          </a>
        </div>
      ) : null}

      {selected ? (
        <div className="mt-4 hidden md:block">
          <SubscriptionBillingSummary
            amountDueCents={selected.amount}
            totalPaidCents={selected.totalPaid}
          />
        </div>
      ) : null}
    </FormSection>
  );
}
