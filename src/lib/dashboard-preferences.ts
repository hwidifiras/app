import type { AuthRole } from "@/lib/auth";
import { deriveUserRoleIntent } from "@/lib/user-role-intent";

export const DASHBOARD_DEFAULT_MODES = ["AUTO", "RECEPTION", "PILOTAGE"] as const;
export type DashboardDefaultMode = (typeof DASHBOARD_DEFAULT_MODES)[number];
export type DashboardMode = "RECEPTION" | "PILOTAGE";

export type DashboardPreferenceSettings = {
  dashboardDefaultMode: DashboardDefaultMode;
  dashboardShowTodaySessions: boolean;
  dashboardShowCashToday: boolean;
  dashboardShowDataConfidence: boolean;
  dashboardShowCashTrend: boolean;
  dashboardShowMembersOverview: boolean;
  dashboardShowCommercialInsights: boolean;
  dashboardShowDetailedDebts: boolean;
};

export type DashboardWidgetVisibility = {
  todaySessions: boolean;
  cashToday: boolean;
  dataConfidence: boolean;
  cashTrend: boolean;
  membersOverview: boolean;
  commercialInsights: boolean;
  detailedDebts: boolean;
};

export function normalizeDashboardDefaultMode(value: unknown): DashboardDefaultMode {
  return DASHBOARD_DEFAULT_MODES.includes(value as DashboardDefaultMode)
    ? (value as DashboardDefaultMode)
    : "AUTO";
}

export function normalizeDashboardQueryView(value: unknown): DashboardMode | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "reception") return "RECEPTION";
  if (normalized === "pilotage") return "PILOTAGE";
  return null;
}

export function canUseDashboardViewOverride(role: AuthRole, permissions: string[] = []) {
  return deriveUserRoleIntent(role, permissions) !== "COACH";
}

export function resolveDashboardMode({
  defaultMode,
  role,
  permissions = [],
  queryView,
}: {
  defaultMode: DashboardDefaultMode;
  role: AuthRole;
  permissions?: string[];
  queryView?: unknown;
}): DashboardMode {
  const requestedMode = normalizeDashboardQueryView(queryView);
  if (requestedMode && canUseDashboardViewOverride(role, permissions)) {
    return requestedMode;
  }

  if (defaultMode === "RECEPTION" || defaultMode === "PILOTAGE") {
    if (defaultMode === "PILOTAGE" && deriveUserRoleIntent(role, permissions) === "COACH") {
      return "RECEPTION";
    }
    return defaultMode;
  }

  return role === "ADMIN" ? "PILOTAGE" : "RECEPTION";
}

export function getDashboardWidgetVisibility(
  settings: DashboardPreferenceSettings,
  mode: DashboardMode,
  role: AuthRole,
  permissions: string[] = [],
): DashboardWidgetVisibility {
  const roleIntent = deriveUserRoleIntent(role, permissions);
  const canSeePilotageWidgets = mode === "PILOTAGE" && roleIntent !== "COACH";

  return {
    todaySessions: settings.dashboardShowTodaySessions,
    cashToday: settings.dashboardShowCashToday,
    dataConfidence: settings.dashboardShowDataConfidence,
    cashTrend: settings.dashboardShowCashTrend,
    membersOverview: settings.dashboardShowMembersOverview,
    commercialInsights: settings.dashboardShowCommercialInsights && canSeePilotageWidgets,
    detailedDebts: settings.dashboardShowDetailedDebts,
  };
}
