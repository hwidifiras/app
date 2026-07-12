import { SettingsToggleRow } from "@/components/settings/settings-toggle-row";
import { FormField, FormGrid, FormSection } from "@/components/ui/form-layout";

export function ClubGymRulesSection({
  allowPartialPayment,
  allowExceptionalAccess,
  duplicateWindowMinutes,
  dailyVisitLimit,
  showDashboardWidget,
  onAllowPartialPaymentChange,
  onAllowExceptionalAccessChange,
  onDuplicateWindowMinutesChange,
  onDailyVisitLimitChange,
  onShowDashboardWidgetChange,
}: {
  allowPartialPayment: boolean;
  allowExceptionalAccess: boolean;
  duplicateWindowMinutes: string;
  dailyVisitLimit: string;
  showDashboardWidget: boolean;
  onAllowPartialPaymentChange: (value: boolean) => void;
  onAllowExceptionalAccessChange: (value: boolean) => void;
  onDuplicateWindowMinutesChange: (value: string) => void;
  onDailyVisitLimitChange: (value: string) => void;
  onShowDashboardWidgetChange: (value: boolean) => void;
}) {
  return (
    <FormSection id="club-gym" title="Accès salle" description="Règles appliquées aux entrées du module salle.">
      <div className="space-y-3">
        <SettingsToggleRow id="gymPartialPayment" label="Accepter un paiement partiel" description="Le membre peut entrer après un premier versement, même si un solde reste dû." checked={allowPartialPayment} onChange={onAllowPartialPaymentChange} />
        <SettingsToggleRow id="gymExceptionalAccess" label="Passage exceptionnel avec motif" description="Autorise un responsable à dépasser une expiration, un quota ou une limite en conservant la raison." checked={allowExceptionalAccess} onChange={onAllowExceptionalAccessChange} />
        <SettingsToggleRow id="gymDashboardWidget" label="Afficher l'aperçu salle au dashboard" description="Montre les entrées du jour et les pass actifs dans la vue pilotage." checked={showDashboardWidget} onChange={onShowDashboardWidgetChange} />
      </div>
      <FormGrid className="mt-4">
        <FormField label="Protection double scan (minutes)"><input className="field" type="number" min="0" max="30" value={duplicateWindowMinutes} onChange={(event) => onDuplicateWindowMinutesChange(event.target.value)} /></FormField>
        <FormField label="Limite quotidienne par membre" hint="Laissez vide pour aucune limite"><input className="field" type="number" min="1" max="20" value={dailyVisitLimit} onChange={(event) => onDailyVisitLimitChange(event.target.value)} placeholder="Aucune" /></FormField>
      </FormGrid>
    </FormSection>
  );
}
