"use client";

import { SettingsToggleRow } from "@/components/settings/settings-toggle-row";
import { FormGrid, FormSection } from "@/components/ui/form-layout";
import { type DashboardDefaultMode } from "@/lib/dashboard-preferences";
import { cn } from "@/lib/utils";

const DASHBOARD_MODE_OPTIONS: Array<{
  value: DashboardDefaultMode;
  label: string;
  description: string;
}> = [
  { value: "AUTO", label: "Automatique", description: "Admin en pilotage, equipe en reception." },
  { value: "RECEPTION", label: "Reception", description: "Accueil quotidien plus simple." },
  { value: "PILOTAGE", label: "Pilotage", description: "Vue dirigeant avec indicateurs." },
];

type ClubDashboardSectionProps = {
  classModuleEnabled?: boolean;
  dashboardDefaultMode: DashboardDefaultMode;
  dashboardShowTodaySessions: boolean;
  dashboardShowCashToday: boolean;
  dashboardShowDataConfidence: boolean;
  dashboardShowCashTrend: boolean;
  dashboardShowMembersOverview: boolean;
  dashboardShowCommercialInsights: boolean;
  dashboardShowDetailedDebts: boolean;
  onDashboardDefaultModeChange: (mode: DashboardDefaultMode) => void;
  onDashboardShowTodaySessionsChange: (checked: boolean) => void;
  onDashboardShowCashTodayChange: (checked: boolean) => void;
  onDashboardShowDataConfidenceChange: (checked: boolean) => void;
  onDashboardShowCashTrendChange: (checked: boolean) => void;
  onDashboardShowMembersOverviewChange: (checked: boolean) => void;
  onDashboardShowCommercialInsightsChange: (checked: boolean) => void;
  onDashboardShowDetailedDebtsChange: (checked: boolean) => void;
};

export function ClubDashboardSection({
  classModuleEnabled = true,
  dashboardDefaultMode,
  dashboardShowTodaySessions,
  dashboardShowCashToday,
  dashboardShowDataConfidence,
  dashboardShowCashTrend,
  dashboardShowMembersOverview,
  dashboardShowCommercialInsights,
  dashboardShowDetailedDebts,
  onDashboardDefaultModeChange,
  onDashboardShowTodaySessionsChange,
  onDashboardShowCashTodayChange,
  onDashboardShowDataConfidenceChange,
  onDashboardShowCashTrendChange,
  onDashboardShowMembersOverviewChange,
  onDashboardShowCommercialInsightsChange,
  onDashboardShowDetailedDebtsChange,
}: ClubDashboardSectionProps) {
  function applyReceptionPreset() {
    onDashboardDefaultModeChange("RECEPTION");
    onDashboardShowTodaySessionsChange(true);
    onDashboardShowCashTodayChange(true);
    onDashboardShowDataConfidenceChange(true);
    onDashboardShowCashTrendChange(true);
    onDashboardShowMembersOverviewChange(true);
    onDashboardShowCommercialInsightsChange(false);
    onDashboardShowDetailedDebtsChange(true);
  }

  function applyPilotagePreset() {
    onDashboardDefaultModeChange("PILOTAGE");
    onDashboardShowTodaySessionsChange(true);
    onDashboardShowCashTodayChange(true);
    onDashboardShowDataConfidenceChange(true);
    onDashboardShowCashTrendChange(true);
    onDashboardShowMembersOverviewChange(true);
    onDashboardShowCommercialInsightsChange(true);
    onDashboardShowDetailedDebtsChange(true);
  }

  return (
    <FormSection
      id="club-dashboard"
      title="Dashboard"
      description="Choisissez le niveau de lecture et les blocs visibles sur l'accueil."
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-border/80 bg-[var(--surface-soft)] p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">Vue par defaut</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                La reception voit le quotidien. Le pilotage montre plus d&apos;indicateurs de direction.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary btn-sm" onClick={applyReceptionPreset}>
                Profil reception
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={applyPilotagePreset}>
                Profil pilotage
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {DASHBOARD_MODE_OPTIONS.map((option) => {
              const selected = dashboardDefaultMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onDashboardDefaultModeChange(option.value)}
                  className={cn(
                    "rounded-lg border px-3 py-3 text-left transition",
                    selected
                      ? "border-primary bg-primary/8 text-primary shadow-[var(--shadow-panel)]"
                      : "border-border/80 bg-white text-foreground hover:border-primary/30",
                  )}
                >
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {option.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <FormGrid>
          {classModuleEnabled ? (
            <SettingsToggleRow
              id="dashboardShowTodaySessions"
              label="Séances du jour"
              description="Affiche les cours à pointer et les actions du quotidien."
              checked={dashboardShowTodaySessions}
              onChange={onDashboardShowTodaySessionsChange}
            />
          ) : null}
          <SettingsToggleRow
            id="dashboardShowCashToday"
            label="Caisse aujourd'hui"
            description="Affiche l'encaissement net, la semaine, le mois et les modes de paiement."
            checked={dashboardShowCashToday}
            onChange={onDashboardShowCashTodayChange}
          />
          {classModuleEnabled ? (
            <SettingsToggleRow
              id="dashboardShowDataConfidence"
              label="Alertes données"
              description="Signale les réglages incomplets qui peuvent fausser l'exploitation."
              checked={dashboardShowDataConfidence}
              onChange={onDashboardShowDataConfidenceChange}
            />
          ) : null}
          <SettingsToggleRow
            id="dashboardShowCashTrend"
            label="Tendance encaissements"
            description="Affiche le graphique net journalier des 7 derniers jours."
            checked={dashboardShowCashTrend}
            onChange={onDashboardShowCashTrendChange}
          />
          <SettingsToggleRow
            id="dashboardShowMembersOverview"
            label="Apercu membres"
            description="Affiche les membres actifs, nouveaux, expirants et derniers inscrits."
            checked={dashboardShowMembersOverview}
            onChange={onDashboardShowMembersOverviewChange}
          />
          <SettingsToggleRow
            id="dashboardShowCommercialInsights"
            label="Suivi commercial"
            description="Affiche ventes, impayes, meilleures formules, remises et recus en vue pilotage."
            checked={dashboardShowCommercialInsights}
            onChange={onDashboardShowCommercialInsightsChange}
          />
          <SettingsToggleRow
            id="dashboardShowDetailedDebts"
            label="Impayes detailles"
            description="Affiche la liste de relance detaillee quand des soldes restent dus."
            checked={dashboardShowDetailedDebts}
            onChange={onDashboardShowDetailedDebtsChange}
          />
        </FormGrid>
      </div>
    </FormSection>
  );
}
