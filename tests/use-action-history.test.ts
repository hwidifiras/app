import { describe, expect, it } from "vitest";

import { findLastEntryIndex, type ActionHistoryEntry } from "@/hooks/use-action-history";

describe("useActionHistory helpers", () => {
  it("returns the last entry when no scope is provided", () => {
    const entries: ActionHistoryEntry<string>[] = [
      { scope: "a", undo: async () => true },
      { scope: "b", undo: async () => true },
    ];

    expect(findLastEntryIndex(entries)).toBe(1);
  });

  it("finds the last entry for a given scope", () => {
    const entries: ActionHistoryEntry<string>[] = [
      { scope: "session-1", undo: async () => true },
      { scope: "session-2", undo: async () => true },
      { scope: "session-1", undo: async () => true },
    ];

    expect(findLastEntryIndex(entries, "session-1")).toBe(2);
    expect(findLastEntryIndex(entries, "session-2")).toBe(1);
    expect(findLastEntryIndex(entries, "missing")).toBe(-1);
  });
});
