import type { AuthRole } from "@/lib/auth";
import { hasPermission } from "@/lib/permission-definitions";
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
  const isAdmin = role === "ADMIN";
  const canSeeAttendance = isAdmin || hasPermission(permissions, "class.attendance") || hasPermission(permissions, "class.manage");
  const canSeeCash = isAdmin || hasPermission(permissions, "payments.collect") || hasPermission(permissions, "reports.finance");
  const canSeeFinance = isAdmin || hasPermission(permissions, "reports.finance");
  const canSeeMembers = isAdmin || hasPermission(permissions, "members.manage") || hasPermission(permissions, "enrollment.sell");
  const canSeeDataConfidence =
    isAdmin ||
    hasPermission(permissions, "settings.manage") ||
    hasPermission(permissions, "class.manage") ||
    hasPermission(permissions, "gym.manage");
  const canSeePilotageWidgets = mode === "PILOTAGE" && roleIntent !== "COACH" && canSeeFinance;

  return {
    todaySessions: settings.dashboardShowTodaySessions && canSeeAttendance,
    cashToday: settings.dashboardShowCashToday && canSeeCash,
    dataConfidence: settings.dashboardShowDataConfidence && canSeeDataConfidence,
    cashTrend: settings.dashboardShowCashTrend && canSeeFinance,
    membersOverview: settings.dashboardShowMembersOverview && canSeeMembers,
    commercialInsights: settings.dashboardShowCommercialInsights && canSeePilotageWidgets,
    detailedDebts: settings.dashboardShowDetailedDebts && canSeeFinance,
  };
}
