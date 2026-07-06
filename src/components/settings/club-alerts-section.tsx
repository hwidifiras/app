import { FieldControl } from "@/components/ui/field-control";
import { FormField, FormGrid, FormSection } from "@/components/ui/form-layout";
import { MONEY_INPUT_SUFFIX } from "@/lib/money";

type ClubAlertsSectionProps = {
  debtThresholdAmount: string;
  maxStaffDiscountPercent: string;
  onDebtThresholdAmountChange: (value: string) => void;
  onMaxStaffDiscountPercentChange: (value: string) => void;
};

export function ClubAlertsSection({
  debtThresholdAmount,
  maxStaffDiscountPercent,
  onDebtThresholdAmountChange,
  onMaxStaffDiscountPercentChange,
}: ClubAlertsSectionProps) {
  return (
    <FormSection
      id="club-alerts"
      title="Alertes et remises"
      description="Réglez les montants visibles et la marge de remise accordée à l'équipe."
    >
      <FormGrid>
        <FormField
          label="Afficher les dettes à partir de"
          htmlFor="debtThreshold"
          hint="Laissez vide ou saisissez 0 pour afficher toutes les dettes."
        >
          <FieldControl suffix={MONEY_INPUT_SUFFIX}>
            <input
              id="debtThreshold"
              type="text"
              inputMode="decimal"
              className="field pr-10"
              value={debtThresholdAmount}
              onChange={(event) => onDebtThresholdAmountChange(event.target.value)}
              placeholder="0"
            />
          </FieldControl>
        </FormField>
        <FormField
          label="Réduction maximale de l'équipe"
          htmlFor="maxStaffDiscount"
          hint="Limite appliquée aux comptes non administrateurs."
        >
          <FieldControl suffix="%">
            <input
              id="maxStaffDiscount"
              type="number"
              min={0}
              max={100}
              step={1}
              className="field pr-10"
              value={maxStaffDiscountPercent}
              onChange={(event) => onMaxStaffDiscountPercentChange(event.target.value)}
              required
            />
          </FieldControl>
        </FormField>
      </FormGrid>
    </FormSection>
  );
}
