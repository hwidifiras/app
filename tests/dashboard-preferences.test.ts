import { describe, expect, it } from "vitest";

import {
  canUseDashboardViewOverride,
  getDashboardWidgetVisibility,
  normalizeDashboardDefaultMode,
  normalizeDashboardQueryView,
  resolveDashboardMode,
  type DashboardPreferenceSettings,
} from "@/lib/dashboard-preferences";

const fullSettings: DashboardPreferenceSettings = {
  dashboardDefaultMode: "AUTO",
  dashboardShowTodaySessions: true,
  dashboardShowCashToday: true,
  dashboardShowDataConfidence: true,
  dashboardShowCashTrend: true,
  dashboardShowMembersOverview: true,
  dashboardShowCommercialInsights: true,
  dashboardShowDetailedDebts: true,
};

describe("dashboard preferences", () => {
  it("normalizes dashboard modes and query views", () => {
    expect(normalizeDashboardDefaultMode("AUTO")).toBe("AUTO");
    expect(normalizeDashboardDefaultMode("RECEPTION")).toBe("RECEPTION");
    expect(normalizeDashboardDefaultMode("bad")).toBe("AUTO");
    expect(normalizeDashboardQueryView("reception")).toBe("RECEPTION");
    expect(normalizeDashboardQueryView("pilotage")).toBe("PILOTAGE");
    expect(normalizeDashboardQueryView("unknown")).toBeNull();
  });

  it("maps automatic mode by role", () => {
    expect(resolveDashboardMode({ defaultMode: "AUTO", role: "ADMIN" })).toBe("PILOTAGE");
    expect(resolveDashboardMode({ defaultMode: "AUTO", role: "STAFF" })).toBe("RECEPTION");
  });

  it("allows reception-style staff to switch view but keeps coach-style staff in reception", () => {
    const receptionPermissions = ["payments.manage"];

    expect(canUseDashboardViewOverride("STAFF", receptionPermissions)).toBe(true);
    expect(resolveDashboardMode({ defaultMode: "RECEPTION", role: "STAFF", permissions: receptionPermissions, queryView: "pilotage" })).toBe(
      "PILOTAGE",
    );

    expect(canUseDashboardViewOverride("STAFF", ["attendance.manage"])).toBe(false);
    expect(resolveDashboardMode({ defaultMode: "PILOTAGE", role: "STAFF", permissions: ["attendance.manage"] })).toBe("RECEPTION");
  });

  it("hides pilotage-only widgets outside pilotage mode and respects widget toggles", () => {
    expect(getDashboardWidgetVisibility(fullSettings, "RECEPTION", "ADMIN").commercialInsights).toBe(false);
    expect(getDashboardWidgetVisibility(fullSettings, "PILOTAGE", "ADMIN").commercialInsights).toBe(true);

    const hidden = getDashboardWidgetVisibility(
      { ...fullSettings, dashboardShowCashTrend: false, dashboardShowDetailedDebts: false },
      "PILOTAGE",
      "ADMIN",
    );

    expect(hidden.cashTrend).toBe(false);
    expect(hidden.detailedDebts).toBe(false);
  });
});
