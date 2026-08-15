import { describe, expect, it } from "vitest";

import {
  coachAttendanceWhere,
  coachGroupWhere,
  coachSessionWhere,
  isCoachScopedUser,
} from "@/modules/classes/coach-scope";

describe("coach data scope", () => {
  const coach = { role: "STAFF" as const, coachId: "coach-1" };

  it("scopes sessions to explicit or inherited coach assignment", () => {
    expect(coachSessionWhere(coach)).toEqual({
      OR: [
        { coachId: "coach-1" },
        { coachId: null, group: { coachId: "coach-1" } },
      ],
    });
    expect(coachGroupWhere(coach)).toEqual({ coachId: "coach-1" });
    expect(coachAttendanceWhere(coach)).toEqual({ session: coachSessionWhere(coach) });
  });

  it("does not narrow administrators or unlinked staff", () => {
    expect(isCoachScopedUser({ role: "ADMIN", coachId: "coach-1" })).toBe(false);
    expect(coachSessionWhere({ role: "ADMIN", coachId: "coach-1" })).toEqual({});
    expect(coachSessionWhere({ role: "STAFF", coachId: null })).toEqual({});
  });
});
