import { describe, expect, it } from "vitest";

import { formatAttendanceOperator, isLikelyInternalId } from "@/lib/attendance-display";
import { formatRoomLabel } from "@/lib/group-room";

describe("display formatting helpers", () => {
  it("does not duplicate the room label", () => {
    expect(formatRoomLabel("Salle audit")).toBe("Salle audit");
    expect(formatRoomLabel("Dojo 1")).toBe("Salle Dojo 1");
    expect(formatRoomLabel("")).toBe("Salle à définir");
  });

  it("hides technical attendance operator ids when no display name is available", () => {
    expect(isLikelyInternalId("audit-ux-admin")).toBe(true);
    expect(formatAttendanceOperator("audit-ux-admin")).toBe("Utilisateur");
    expect(formatAttendanceOperator("audit-ux-admin", new Map([["audit-ux-admin", "Audit UX"]]))).toBe("Audit UX");
  });
});
