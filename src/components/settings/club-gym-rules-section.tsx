import { Clock3, Plus, Trash2 } from "lucide-react";

import { SettingsToggleRow } from "@/components/settings/settings-toggle-row";
import { FormField, FormGrid, FormSection } from "@/components/ui/form-layout";
import { CLUB_DAY_LABELS, WORKING_DAY_ORDER } from "@/lib/club-working-days";
import type { GymOpeningWindow } from "@/modules/gym/opening-hours";

export function ClubGymRulesSection({
  allowPartialPayment,
  allowExceptionalAccess,
  duplicateWindowMinutes,
  dailyVisitLimit,
  showDashboardWidget,
  enforceOpeningHours,
  openingHours,
  onAllowPartialPaymentChange,
  onAllowExceptionalAccessChange,
  onDuplicateWindowMinutesChange,
  onDailyVisitLimitChange,
  onShowDashboardWidgetChange,
  onEnforceOpeningHoursChange,
  onOpeningHoursChange,
}: {
  allowPartialPayment: boolean;
  allowExceptionalAccess: boolean;
  duplicateWindowMinutes: string;
  dailyVisitLimit: string;
  showDashboardWidget: boolean;
  enforceOpeningHours: boolean;
  openingHours: GymOpeningWindow[];
  onAllowPartialPaymentChange: (value: boolean) => void;
  onAllowExceptionalAccessChange: (value: boolean) => void;
  onDuplicateWindowMinutesChange: (value: string) => void;
  onDailyVisitLimitChange: (value: string) => void;
  onShowDashboardWidgetChange: (value: boolean) => void;
  onEnforceOpeningHoursChange: (value: boolean) => void;
  onOpeningHoursChange: (value: GymOpeningWindow[]) => void;
}) {
  function addWindow(dayOfWeek: GymOpeningWindow["dayOfWeek"]) {
    onOpeningHoursChange([...openingHours, { dayOfWeek, opensAt: "06:00", closesAt: "22:00" }]);
  }

  function updateWindow(index: number, field: "opensAt" | "closesAt", value: string) {
    onOpeningHoursChange(
      openingHours.map((window, rowIndex) => rowIndex === index ? { ...window, [field]: value } : window),
    );
  }

  function removeWindow(index: number) {
    onOpeningHoursChange(openingHours.filter((_, rowIndex) => rowIndex !== index));
  }

  function applyStandardHours() {
    onOpeningHoursChange(
      WORKING_DAY_ORDER
        .filter((day) => day !== "SUNDAY")
        .map((dayOfWeek) => ({ dayOfWeek, opensAt: "06:00", closesAt: "22:00" })),
    );
  }

  return (
    <FormSection id="club-gym" title="Accès salle" description="Règles appliquées aux entrées du module salle.">
      <div className="space-y-3">
        <SettingsToggleRow id="gymPartialPayment" label="Accepter un paiement partiel" description="Le membre peut entrer après un premier versement, même si un solde reste dû." checked={allowPartialPayment} onChange={onAllowPartialPaymentChange} />
        <SettingsToggleRow id="gymExceptionalAccess" label="Passage exceptionnel avec motif" description="Autorise un responsable à dépasser une expiration, un quota ou une limite en conservant la raison." checked={allowExceptionalAccess} onChange={onAllowExceptionalAccessChange} />
        <SettingsToggleRow id="gymDashboardWidget" label="Afficher l'aperçu salle au dashboard" description="Montre les entrées du jour et les pass actifs dans la vue pilotage." checked={showDashboardWidget} onChange={onShowDashboardWidgetChange} />
        <SettingsToggleRow id="gymOpeningHoursEnabled" label="Contrôler les horaires d'ouverture" description="Refuse un passage hors des créneaux ci-dessous, sauf autorisation exceptionnelle avec motif." checked={enforceOpeningHours} onChange={onEnforceOpeningHoursChange} />
      </div>
      <FormGrid className="mt-4">
        <FormField label="Protection double scan (minutes)"><input className="field" type="number" min="0" max="30" value={duplicateWindowMinutes} onChange={(event) => onDuplicateWindowMinutesChange(event.target.value)} /></FormField>
        <FormField label="Limite quotidienne par membre" hint="Laissez vide pour aucune limite"><input className="field" type="number" min="1" max="20" value={dailyVisitLimit} onChange={(event) => onDailyVisitLimitChange(event.target.value)} placeholder="Aucune" /></FormField>
      </FormGrid>

      <div className="mt-5 border-t border-[var(--border)] pt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
              <Clock3 className="size-4 text-[var(--primary)]" /> Horaires d&apos;ouverture salle
            </h3>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Ajoutez plusieurs créneaux pour une journée coupée, par exemple matin et soir.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm self-start" onClick={applyStandardHours}>
            Lun.-sam. 06:00-22:00
          </button>
        </div>

        <div className="mt-4 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {WORKING_DAY_ORDER.map((day) => {
            const rows = openingHours
              .map((window, index) => ({ window, index }))
              .filter(({ window }) => window.dayOfWeek === day);
            return (
              <div key={day} className="grid gap-2 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-start">
                <p className="pt-2 text-sm font-semibold text-[var(--foreground)]">{CLUB_DAY_LABELS[day]}</p>
                <div className="space-y-2">
                  {rows.length === 0 ? (
                    <p className="py-2 text-sm text-[var(--muted-foreground)]">Fermé</p>
                  ) : rows.map(({ window, index }) => (
                    <div key={`${day}-${index}`} className="flex min-w-0 items-center gap-2">
                      <input aria-label={`Ouverture ${CLUB_DAY_LABELS[day]}`} type="time" className="field min-w-0 flex-1" value={window.opensAt} onChange={(event) => updateWindow(index, "opensAt", event.target.value)} />
                      <span className="text-xs text-[var(--muted-foreground)]">à</span>
                      <input aria-label={`Fermeture ${CLUB_DAY_LABELS[day]}`} type="time" className="field min-w-0 flex-1" value={window.closesAt} onChange={(event) => updateWindow(index, "closesAt", event.target.value)} />
                      <button type="button" className="btn btn-ghost btn-icon shrink-0" title="Supprimer ce créneau" aria-label={`Supprimer le créneau ${CLUB_DAY_LABELS[day]}`} onClick={() => removeWindow(index)}>
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-ghost btn-sm justify-self-start" onClick={() => addWindow(day)}>
                  <Plus className="size-4" /> Ajouter
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </FormSection>
  );
}
