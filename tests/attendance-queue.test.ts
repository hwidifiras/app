import { describe, expect, it } from "vitest";

import {
  deriveEffectiveAttendanceQueueState,
  tenantClockAt,
} from "@/lib/attendance-queue";

const session = {
  sessionDate: "2026-08-24T00:00:00.000Z",
  startTime: "18:00",
  endTime: "19:00",
  status: "PLANNED",
  operationalStatus: "UPCOMING" as const,
  unmarkedCount: 2,
};

describe("live attendance queue", () => {
  it("moves an open session to regularization at its end boundary", () => {
    expect(
      deriveEffectiveAttendanceQueueState(session, {
        dayIso: "2026-08-24",
        minutes: 18 * 60 + 59,
      }),
    ).toEqual(expect.objectContaining({
      queueKind: "NOW",
      operationalStatus: "UPCOMING",
      ended: false,
    }));

    expect(
      deriveEffectiveAttendanceQueueState(session, {
        dayIso: "2026-08-24",
        minutes: 19 * 60,
      }),
    ).toEqual(expect.objectContaining({
      queueKind: "REGULARIZE",
      operationalStatus: "NEEDS_FINALIZATION",
      ended: true,
      canFinalize: false,
    }));

    // The mounted server snapshot remains untouched, including local attendance edits.
    expect(session.operationalStatus).toBe("UPCOMING");
  });

  it("keeps a fully checked session actionable for finalization after it ends", () => {
    expect(
      deriveEffectiveAttendanceQueueState(
        { ...session, unmarkedCount: 0 },
        { dayIso: "2026-08-24", minutes: 19 * 60 },
      ),
    ).toEqual(expect.objectContaining({
      queueKind: "REGULARIZE",
      canFinalize: true,
    }));
  });

  it("reclassifies both sides of tenant midnight without a stale NEXT state", () => {
    const previousDay = deriveEffectiveAttendanceQueueState(session, {
      dayIso: "2026-08-25",
      minutes: 0,
    });
    const newDay = deriveEffectiveAttendanceQueueState(
      {
        ...session,
        sessionDate: "2026-08-25T00:00:00.000Z",
        startTime: "00:00",
        endTime: "00:30",
      },
      { dayIso: "2026-08-25", minutes: 0 },
    );

    expect(previousDay).toEqual(expect.objectContaining({
      dateCategory: "OVERDUE",
      queueKind: "REGULARIZE",
      operationalStatus: "NEEDS_FINALIZATION",
    }));
    expect(newDay).toEqual(expect.objectContaining({
      dateCategory: "TODAY",
      queueKind: "NOW",
      operationalStatus: "UPCOMING",
    }));
  });

  it("derives the calendar day and minute in the tenant timezone", () => {
    expect(tenantClockAt(new Date("2026-08-24T10:05:00.000Z"), "Pacific/Kiritimati"))
      .toEqual({ dayIso: "2026-08-25", minutes: 5 });
  });

  it("keeps completed sessions final and excludes cancelled sessions from the queue", () => {
    expect(
      deriveEffectiveAttendanceQueueState(
        { ...session, status: "COMPLETED", operationalStatus: "COMPLETED" },
        { dayIso: "2026-08-25", minutes: 0 },
      ).queueKind,
    ).toBe("DONE");
    expect(
      deriveEffectiveAttendanceQueueState(
        { ...session, status: "CANCELLED", operationalStatus: "CANCELLED" },
        { dayIso: "2026-08-24", minutes: 18 * 60 + 30 },
      ).queueKind,
    ).toBeNull();
  });
});
