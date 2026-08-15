import { describe, expect, it } from "vitest";

import {
  FULL_STAFF_PERMISSIONS,
  parsePermissions,
} from "@/lib/permission-definitions";
import {
  STAFF_ACCESS_PRESETS,
  staffPresetsForProfile,
} from "@/lib/user-access-presets";
import { deriveUserRoleIntent } from "@/lib/user-role-intent";

describe("canonical permissions", () => {
  it("translates legacy permissions without dropping established access", () => {
    expect(parsePermissions(["attendance.manage"])).toEqual(["class.attendance"]);
    expect(parsePermissions(["payments.manage"])).toEqual([
      "payments.collect",
      "payments.correct",
      "reports.finance",
    ]);
    expect(parsePermissions(["catalog.manage", "offers.manage"])).toEqual([
      "subscriptions.correct",
      "plans.manage",
      "class.manage",
    ]);
  });

  it("keeps canonical permissions ordered and deduplicated", () => {
    expect(parsePermissions(["payments.collect", "payments.manage", "payments.collect"])).toEqual([
      "payments.collect",
      "payments.correct",
      "reports.finance",
    ]);
  });

  it("defines least-privilege reception and coach presets", () => {
    expect(STAFF_ACCESS_PRESETS.RECEPTION_CLASS.permissions).not.toContain("payments.correct");
    expect(STAFF_ACCESS_PRESETS.RECEPTION_GYM.permissions).toContain("gym.checkin");
    expect(STAFF_ACCESS_PRESETS.COACH.permissions).toEqual(["class.attendance"]);
    expect(STAFF_ACCESS_PRESETS.MANAGER.permissions).toEqual(FULL_STAFF_PERMISSIONS);
  });

  it("only presents presets relevant to the tenant edition", () => {
    expect(staffPresetsForProfile("CLASS_ONLY").map((preset) => preset.id)).toEqual([
      "MANAGER",
      "RECEPTION_CLASS",
      "COACH",
    ]);
    expect(staffPresetsForProfile("GYM_ONLY").map((preset) => preset.id)).toEqual([
      "MANAGER",
      "RECEPTION_GYM",
    ]);
  });

  it("uses the coach link as the authoritative staff intent", () => {
    expect(deriveUserRoleIntent("STAFF", ["class.attendance"], "coach-1")).toBe("COACH");
    expect(deriveUserRoleIntent("STAFF", ["members.manage", "payments.collect"])).toBe("RECEPTION");
    expect(deriveUserRoleIntent("STAFF", ["settings.manage"])).toBe("MANAGER");
  });
});
