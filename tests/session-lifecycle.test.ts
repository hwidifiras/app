import { describe, expect, it } from "vitest";

import {
  deriveSessionLifecycle,
  expectedMemberIdsAtSession,
  isSessionEnded,
} from "@/lib/session-lifecycle";

describe("session lifecycle", () => {
  const now = new Date("2026-06-13T12:00:00.000Z");

  it("marks a past planned session as needing finalization", () => {
    expect(
      deriveSessionLifecycle({
        status: "PLANNED",
        sessionDate: new Date("2026-06-11T00:00:00.000Z"),
        endTime: "19:30",
        expectedMemberIds: ["m1", "m2"],
        attendanceMemberIds: ["m1"],
        now,
      }),
    ).toEqual(
      expect.objectContaining({
        operationalStatus: "NEEDS_FINALIZATION",
        unmarkedCount: 1,
        canFinalize: false,
      }),
    );
  });

  it("allows finalization only when every expected member is checked", () => {
    expect(
      deriveSessionLifecycle({
        status: "PLANNED",
        sessionDate: new Date("2026-06-11T00:00:00.000Z"),
        endTime: "19:30",
        expectedMemberIds: ["m1", "m2"],
        attendanceMemberIds: ["m1", "m2"],
        now,
      }),
    ).toEqual(
      expect.objectContaining({
        operationalStatus: "NEEDS_FINALIZATION",
        unmarkedCount: 0,
        canFinalize: true,
      }),
    );
  });

  it("uses assignment dates to reconstruct the historical class list", () => {
    const sessionDate = new Date("2026-06-11T00:00:00.000Z");
    expect(
      expectedMemberIdsAtSession(
        [
          {
            memberId: "active-then",
            status: "ACTIVE",
            startDate: new Date("2026-05-01T00:00:00.000Z"),
            endDate: new Date("2026-06-12T00:00:00.000Z"),
            member: { status: "ACTIVE" },
          },
          {
            memberId: "joined-later",
            status: "ACTIVE",
            startDate: new Date("2026-06-12T00:00:00.000Z"),
            endDate: null,
            member: { status: "ACTIVE" },
          },
        ],
        sessionDate,
      ),
    ).toEqual(["active-then"]);
  });

  it("excludes assignments closed by same-day member resignation", () => {
    const sessionDate = new Date("2026-06-11T00:00:00.000Z");
    expect(
      expectedMemberIdsAtSession(
        [
          {
            memberId: "resigned-today",
            status: "INACTIVE",
            startDate: new Date("2026-05-01T00:00:00.000Z"),
            endDate: new Date("2026-06-11T13:00:00.000Z"),
            member: { status: "ARCHIVED" },
          },
          {
            memberId: "still-active",
            status: "ACTIVE",
            startDate: new Date("2026-05-01T00:00:00.000Z"),
            endDate: null,
            member: { status: "ACTIVE" },
          },
        ],
        sessionDate,
      ),
    ).toEqual(["still-active"]);
  });

  it("does not count archived members even if an old assignment still has no end date", () => {
    const sessionDate = new Date("2026-06-11T00:00:00.000Z");
    expect(
      expectedMemberIdsAtSession(
        [
          {
            memberId: "archived",
            status: "ACTIVE",
            startDate: new Date("2026-05-01T00:00:00.000Z"),
            endDate: null,
            member: { status: "ARCHIVED" },
          },
        ],
        sessionDate,
      ),
    ).toEqual([]);
  });

  it("compares the session end in the club timezone", () => {
    expect(
      isSessionEnded(
        new Date("2026-06-13T00:00:00.000Z"),
        "13:30",
        new Date("2026-06-13T13:00:00.000Z"),
        "Africa/Tunis",
      ),
    ).toBe(true);
  });
});
