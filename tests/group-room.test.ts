import { describe, expect, it } from "vitest";

import {
  formatGroupRoomLabel,
  normalizeGroupRoomInput,
  sessionRoomFromGroup,
} from "@/lib/group-room";

describe("group room helpers", () => {
  it("normalizes blank room to null", () => {
    expect(normalizeGroupRoomInput("  ")).toBeNull();
    expect(normalizeGroupRoomInput(undefined)).toBeNull();
  });

  it("formats missing room for display", () => {
    expect(formatGroupRoomLabel(null)).toBe("Par séance");
    expect(formatGroupRoomLabel("Dojo A")).toBe("Dojo A");
  });

  it("uses empty session room when group has no default", () => {
    expect(sessionRoomFromGroup(null)).toBe("");
    expect(sessionRoomFromGroup("Ring 1")).toBe("Ring 1");
  });
});
