import { describe, expect, it } from "vitest";

import {
  registrationOnlyNavItemIsAllowed,
  registrationOnlyPageIsAllowed,
} from "@/lib/registration-only-workspace";
import { getPrimaryNavigationSections } from "@/components/layout/app-sidebar";
import { FULL_STAFF_PERMISSIONS } from "@/lib/permission-definitions";

describe("focused operations workspace", () => {
  it("keeps enrollment, finance support, member records, and account access", () => {
    expect(registrationOnlyPageIsAllowed("/enrollment")).toBe(true);
    expect(registrationOnlyPageIsAllowed("/members/member-1")).toBe(true);
    expect(registrationOnlyPageIsAllowed("/receipts/receipt-1")).toBe(true);
    expect(registrationOnlyPageIsAllowed("/payments/new")).toBe(true);
    expect(registrationOnlyPageIsAllowed("/subscriptions/subscription-1/edit")).toBe(true);
    expect(registrationOnlyPageIsAllowed("/settings/account")).toBe(true);
  });

  it("keeps the coherent planning, organisation, and team workflows", () => {
    expect(registrationOnlyPageIsAllowed("/sessions")).toBe(true);
    expect(registrationOnlyPageIsAllowed("/sessions/session-1/postpone")).toBe(true);
    expect(registrationOnlyPageIsAllowed("/groups/group-1/schedules")).toBe(true);
    expect(registrationOnlyPageIsAllowed("/coaches")).toBe(true);
    expect(registrationOnlyPageIsAllowed("/settings/users")).toBe(true);
  });

  it("still removes the dashboard, pointage, gym, and advanced settings", () => {
    expect(registrationOnlyPageIsAllowed("/")).toBe(false);
    expect(registrationOnlyPageIsAllowed("/attendance/today")).toBe(false);
    expect(registrationOnlyPageIsAllowed("/gym/check-in")).toBe(false);
    expect(registrationOnlyPageIsAllowed("/settings/club")).toBe(false);
    expect(registrationOnlyPageIsAllowed("/subscription-plans")).toBe(false);
    expect(registrationOnlyPageIsAllowed("/offers")).toBe(false);
    expect(registrationOnlyPageIsAllowed("/logs")).toBe(false);
  });

  it("shows only the focused operational navigation", () => {
    expect(registrationOnlyNavItemIsAllowed("/enrollment")).toBe(true);
    expect(registrationOnlyNavItemIsAllowed("/members")).toBe(true);
    expect(registrationOnlyNavItemIsAllowed("/settings/account")).toBe(true);
    expect(registrationOnlyNavItemIsAllowed("/payments")).toBe(true);
    expect(registrationOnlyNavItemIsAllowed("/sessions")).toBe(true);
    expect(registrationOnlyNavItemIsAllowed("/groups")).toBe(true);
    expect(registrationOnlyNavItemIsAllowed("/coaches")).toBe(true);
    expect(registrationOnlyNavItemIsAllowed("/settings/users")).toBe(true);
    expect(registrationOnlyNavItemIsAllowed("/attendance/today")).toBe(false);
    expect(registrationOnlyNavItemIsAllowed("/settings/club")).toBe(false);
  });

  it("shows the complete focused menu to admins and keeps team access admin-only", () => {
    const adminSections = getPrimaryNavigationSections({
      role: "ADMIN",
      permissions: [],
      modules: ["CLASS_MANAGEMENT"],
      registrationOnly: true,
    });
    const managerSections = getPrimaryNavigationSections({
      role: "STAFF",
      permissions: FULL_STAFF_PERMISSIONS,
      modules: ["CLASS_MANAGEMENT"],
      registrationOnly: true,
    });

    expect(adminSections.flatMap((section) => section.items.map((item) => item.label))).toEqual([
      "Inscrire",
      "Caisse",
      "Membres",
      "Planning",
      "Groupes & horaires",
      "Coachs",
      "Équipe & accès",
    ]);
    expect(managerSections.flatMap((section) => section.items.map((item) => item.label))).toEqual([
      "Inscrire",
      "Caisse",
      "Membres",
      "Planning",
      "Groupes & horaires",
      "Coachs",
    ]);
  });
});
