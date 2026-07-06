import { SettingsToggleRow } from "@/components/settings/settings-toggle-row";
import { FormSection } from "@/components/ui/form-layout";

type ClubCheckinRulesSectionProps = {
  allowPartialPayment: boolean;
  allowWithoutSubscription: boolean;
  absentConsumesSession: boolean;
  onAllowPartialPaymentChange: (checked: boolean) => void;
  onAllowWithoutSubscriptionChange: (checked: boolean) => void;
  onAbsentConsumesSessionChange: (checked: boolean) => void;
};

export function ClubCheckinRulesSection({
  allowPartialPayment,
  allowWithoutSubscription,
  absentConsumesSession,
  onAllowPartialPaymentChange,
  onAllowWithoutSubscriptionChange,
  onAbsentConsumesSessionChange,
}: ClubCheckinRulesSectionProps) {
  return (
    <FormSection
      id="club-checkin"
      title="Pointage & paiements"
      description="Définissez ce que l'équipe peut accepter pendant le pointage."
    >
      <div className="space-y-3">
        <SettingsToggleRow
          id="allowPartialPayment"
          label="Pointage avec paiement partiel"
          description="Un membre ayant payé une partie de son abonnement peut être pointé présent."
          checked={allowPartialPayment}
          onChange={onAllowPartialPaymentChange}
        />
        <SettingsToggleRow
          id="allowWithoutSubscription"
          label="Autoriser exceptionnellement sans abonnement"
          description="L'équipe pourra enregistrer un passage motivé pour une personne sans abonnement actif."
          checked={allowWithoutSubscription}
          onChange={onAllowWithoutSubscriptionChange}
        />
        <SettingsToggleRow
          id="absentConsumesSession"
          label="Une absence consomme une séance"
          description="Lorsqu'elle est activée, une absence déduit une séance du quota restant."
          checked={absentConsumesSession}
          onChange={onAbsentConsumesSessionChange}
        />
      </div>
    </FormSection>
  );
}
