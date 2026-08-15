import { describe, expect, it } from "vitest";

import {
  findGymOpeningHoursOverlap,
  gymLocalDayRange,
  isGymOpenAt,
  normalizeGymOpeningHours,
} from "@/modules/gym/opening-hours";

describe("gym opening hours", () => {
  it("supports several non-overlapping windows on the same day", () => {
    const windows = normalizeGymOpeningHours([
      { dayOfWeek: "SATURDAY", opensAt: "15:00", closesAt: "21:00" },
      { dayOfWeek: "SATURDAY", opensAt: "06:00", closesAt: "12:00" },
    ]);
    expect(findGymOpeningHoursOverlap(windows)).toBeNull();
    expect(isGymOpenAt(windows, new Date("2026-08-15T10:00:00.000Z"), "Africa/Tunis")).toBe(true);
    expect(isGymOpenAt(windows, new Date("2026-08-15T12:30:00.000Z"), "Africa/Tunis")).toBe(false);
  });

  it("detects overlapping windows and computes the Tunisian calendar day", () => {
    const windows = normalizeGymOpeningHours([
      { dayOfWeek: "MONDAY", opensAt: "06:00", closesAt: "12:00" },
      { dayOfWeek: "MONDAY", opensAt: "11:30", closesAt: "18:00" },
    ]);
    expect(findGymOpeningHoursOverlap(windows)).toBe("MONDAY");
    const range = gymLocalDayRange(new Date("2026-08-15T00:30:00.000Z"), "Africa/Tunis");
    expect(range.start.toISOString()).toBe("2026-08-14T23:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-08-15T23:00:00.000Z");
  });
});
