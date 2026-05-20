import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ token: null as string | null }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (authState.token ? { value: authState.token } : undefined),
  }),
}));

import { prisma } from "@/lib/prisma";
import { POST as createAttendance } from "@/app/api/attendances/route";
import { POST as createPayment } from "@/app/api/payments/route";
import { DELETE as deleteSport } from "@/app/api/sports/route";
import { POST as createMemberSubscription } from "@/app/api/member-subscriptions/route";
import { PATCH as patchClubSettings } from "@/app/api/club-settings/route";
import { POST as createUser } from "@/app/api/users/route";
import { POST as requestPasswordReset } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { signAuthToken, type AuthRole } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  buildEnrollmentQuote,
  canCheckInWithPayment,
  expireStaleSubscriptions,
  resolveActiveSubscription,
} from "@/lib/membership-rules";
import { enrollmentQuoteSchema } from "@/lib/schemas/enrollment";
import { createSubscriptionPlanSchema } from "@/lib/schemas/subscription-plan";

async function resetData() {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.userPermission.deleteMany(),
    prisma.offerApplication.deleteMany(),
    prisma.offer.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.memberSubscription.deleteMany(),
    prisma.groupMember.deleteMany(),
    prisma.session.deleteMany(),
    prisma.groupSchedule.deleteMany(),
    prisma.householdMember.deleteMany(),
    prisma.household.deleteMany(),
    prisma.member.deleteMany(),
    prisma.subscriptionPlan.deleteMany(),
    prisma.group.deleteMany(),
    prisma.coach.deleteMany(),
    prisma.sport.deleteMany(),
    prisma.user.deleteMany(),
    prisma.clubSettings.deleteMany(),
  ]);
  await prisma.clubSettings.create({
    data: {
      id: "default",
      allowCheckInWithPartialPayment: true,
      allowCheckInWithoutSubscription: true,
      allowPublicRegister: false,
      maxStaffDiscountPercent: 30,
      debtAlertThresholdCents: 0,
    },
  });
}

async function dojoFixture() {
  const bjj = await prisma.sport.create({ data: { name: "BJJ" } });
  const karate = await prisma.sport.create({ data: { name: "Karate" } });

  const coach = await prisma.coach.create({
    data: {
      firstName: "Coach",
      lastName: "One",
      phone: `coach-${Date.now()}`,
      sportId: bjj.id,
    },
  });

  const adultBjj = await prisma.group.create({
    data: {
      name: "Adult BJJ",
      groupType: "ADULTS",
      sportId: bjj.id,
      coachId: coach.id,
      capacity: 2,
      room: "Dojo A",
    },
  });

  const adultBjjOverlap = await prisma.group.create({
    data: {
      name: "Adult BJJ Overlap",
      groupType: "ADULTS",
      sportId: bjj.id,
      coachId: coach.id,
      capacity: 10,
      room: "Dojo B",
    },
  });

  const kidBjj = await prisma.group.create({
    data: {
      name: "Kids BJJ",
      groupType: "KIDS",
      sportId: bjj.id,
      coachId: coach.id,
      capacity: 10,
      room: "Dojo C",
    },
  });

  const adultKarate = await prisma.group.create({
    data: {
      name: "Adult Karate",
      groupType: "ADULTS",
      sportId: karate.id,
      coachId: coach.id,
      capacity: 10,
      room: "Dojo D",
    },
  });

  await prisma.groupSchedule.create({
    data: {
      groupId: adultBjj.id,
      dayOfWeek: "MONDAY",
      startTime: "18:00",
      durationMinutes: 90,
    },
  });
  await prisma.groupSchedule.create({
    data: {
      groupId: adultBjjOverlap.id,
      dayOfWeek: "MONDAY",
      startTime: "18:30",
      durationMinutes: 60,
    },
  });
  await prisma.groupSchedule.create({
    data: {
      groupId: adultKarate.id,
      dayOfWeek: "TUESDAY",
      startTime: "18:00",
      durationMinutes: 60,
    },
  });

  const bjjPlan = await prisma.subscriptionPlan.create({
    data: {
      name: "BJJ 12",
      price: 12000,
      totalSessions: 12,
      sessionsPerWeek: 3,
      validityDays: 30,
      sportId: bjj.id,
    },
  });
  const karatePlan = await prisma.subscriptionPlan.create({
    data: {
      name: "Karate 8",
      price: 8000,
      totalSessions: 8,
      validityDays: 30,
      sportId: karate.id,
    },
  });

  const adult = await prisma.member.create({
    data: {
      firstName: "Ali",
      lastName: "Adult",
      phone: "adult-1",
      memberType: "ADULT",
    },
  });
  const kid = await prisma.member.create({
    data: {
      firstName: "Sami",
      lastName: "Kid",
      phone: "kid-1",
      memberType: "KID",
      parentName: "Parent One",
      parentPhone: "parent-phone",
    },
  });

  return {
    bjj,
    karate,
    coach,
    adultBjj,
    adultBjjOverlap,
    kidBjj,
    adultKarate,
    bjjPlan,
    karatePlan,
    adult,
    kid,
  };
}

async function signIn(role: AuthRole = "ADMIN") {
  authState.token = await signAuthToken({
    userId: `${role.toLowerCase()}-test-user`,
    email: `${role.toLowerCase()}@test.local`,
    name: `${role} Test`,
    role,
  });
}

function jsonRequest(method: string, body: unknown) {
  return new Request("http://test.local/api", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function responseJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

async function createActiveSubscription(
  fx: Awaited<ReturnType<typeof dojoFixture>>,
  overrides: Partial<{
    memberId: string;
    planId: string;
    sportId: string;
    amount: number;
    remainingSessions: number;
    startDate: Date;
    endDate: Date | null;
    status: "ACTIVE" | "EXPIRED" | "CANCELLED" | "DRAFT";
  }> = {},
) {
  return prisma.memberSubscription.create({
    data: {
      memberId: overrides.memberId ?? fx.adult.id,
      planId: overrides.planId ?? fx.bjjPlan.id,
      sportId: overrides.sportId ?? fx.bjj.id,
      startDate: overrides.startDate ?? new Date(Date.now() - 86400000),
      endDate: overrides.endDate ?? new Date(Date.now() + 30 * 86400000),
      amount: overrides.amount ?? fx.bjjPlan.price,
      remainingSessions: overrides.remainingSessions ?? 10,
      status: overrides.status ?? "ACTIVE",
    },
  });
}

async function createSessionForGroup(
  groupId: string,
  overrides: Partial<{ sessionDate: Date; startTime: string; endTime: string; room: string }> = {},
) {
  return prisma.session.create({
    data: {
      groupId,
      sessionDate: overrides.sessionDate ?? new Date("2026-05-18T18:00:00.000Z"),
      startTime: overrides.startTime ?? "18:00",
      endTime: overrides.endTime ?? "19:30",
      room: overrides.room ?? "Dojo A",
      status: "PLANNED",
    },
  });
}

beforeEach(async () => {
  authState.token = null;
  await resetData();
});

describe("schema guardrails", () => {
  it("requires a discipline on every subscription plan", () => {
    const parsed = createSubscriptionPlanSchema.safeParse({
      name: "Mensuel",
      price: 3500,
      totalSessions: 12,
      validityDays: 30,
    });

    expect(parsed.success).toBe(false);
  });

  it("requires parent name and phone when enrolling a new child", async () => {
    const fx = await dojoFixture();

    const parsed = enrollmentQuoteSchema.safeParse({
      lines: [
        {
          newMember: {
            firstName: "Child",
            lastName: "No Parent",
            phone: "child-phone",
            memberType: "KID",
          },
          groupId: fx.kidBjj.id,
          planId: fx.bjjPlan.id,
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("enrollment quote edge cases", () => {
  it("blocks plan/course sport mismatch", async () => {
    const fx = await dojoFixture();

    await expect(
      buildEnrollmentQuote([
        { memberId: fx.adult.id, groupId: fx.adultBjj.id, planId: fx.karatePlan.id },
      ]),
    ).rejects.toThrow("PLAN_SPORT_MISMATCH");
  });

  it("blocks adult in kids group and kid in adults group", async () => {
    const fx = await dojoFixture();

    await expect(
      buildEnrollmentQuote([
        { memberId: fx.adult.id, groupId: fx.kidBjj.id, planId: fx.bjjPlan.id },
      ]),
    ).rejects.toThrow("MEMBER_TYPE_MISMATCH");

    await expect(
      buildEnrollmentQuote([
        { memberId: fx.kid.id, groupId: fx.adultBjj.id, planId: fx.bjjPlan.id },
      ]),
    ).rejects.toThrow("MEMBER_TYPE_MISMATCH");
  });

  it("blocks full course capacity before applying enrollment", async () => {
    const fx = await dojoFixture();
    for (const i of [1, 2]) {
      const member = await prisma.member.create({
        data: {
          firstName: `Seat${i}`,
          lastName: "Taken",
          phone: `seat-${i}`,
          memberType: "ADULT",
        },
      });
      await prisma.groupMember.create({
        data: { groupId: fx.adultBjj.id, memberId: member.id, startDate: new Date() },
      });
    }

    const quote = await buildEnrollmentQuote([
      { memberId: fx.adult.id, groupId: fx.adultBjj.id, planId: fx.bjjPlan.id },
    ]);

    expect(quote.blocked).toBe(true);
    expect(quote.lines[0].warnings).toContain("Capacité du cours atteinte");
  });

  it("blocks schedule collisions against existing assignments", async () => {
    const fx = await dojoFixture();
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date() },
    });

    const quote = await buildEnrollmentQuote([
      { memberId: fx.adult.id, groupId: fx.adultBjjOverlap.id, planId: fx.bjjPlan.id },
    ]);

    expect(quote.blocked).toBe(true);
    expect(quote.lines[0].warnings.join(" ")).toContain("Conflit d'horaire");
  });

  it("blocks schedule collisions inside the same quote for the same member", async () => {
    const fx = await dojoFixture();

    const quote = await buildEnrollmentQuote([
      { memberId: fx.adult.id, groupId: fx.adultBjj.id, planId: fx.bjjPlan.id },
      { memberId: fx.adult.id, groupId: fx.adultBjjOverlap.id, planId: fx.bjjPlan.id },
    ]);

    expect(quote.blocked).toBe(true);
    expect(quote.lines[1].warnings.join(" ")).toContain("Conflit d'horaire");
  });
});

describe("subscriptions, payments and offers", () => {
  it("reuses an active subscription for another group in the same discipline", async () => {
    const fx = await dojoFixture();
    await prisma.memberSubscription.create({
      data: {
        memberId: fx.adult.id,
        planId: fx.bjjPlan.id,
        sportId: fx.bjj.id,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 30 * 86400000),
        amount: fx.bjjPlan.price,
        remainingSessions: 10,
        status: "ACTIVE",
      },
    });

    const quote = await buildEnrollmentQuote([
      { memberId: fx.adult.id, groupId: fx.adultBjj.id, planId: fx.bjjPlan.id },
    ]);

    expect(quote.lines[0].reusesExistingSubscription).toBe(true);
  });

  it("allows a second active subscription for another discipline", async () => {
    const fx = await dojoFixture();
    await prisma.memberSubscription.create({
      data: {
        memberId: fx.adult.id,
        planId: fx.bjjPlan.id,
        sportId: fx.bjj.id,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 30 * 86400000),
        amount: fx.bjjPlan.price,
        remainingSessions: 10,
        status: "ACTIVE",
      },
    });

    const quote = await buildEnrollmentQuote([
      { memberId: fx.adult.id, groupId: fx.adultKarate.id, planId: fx.karatePlan.id },
    ]);

    expect(quote.blocked).toBe(false);
    expect(quote.lines[0].reusesExistingSubscription).toBe(false);
  });

  it("blocks family bundle for unrelated existing members", async () => {
    const fx = await dojoFixture();
    const offer = await prisma.offer.create({
      data: {
        name: "Famille",
        kind: "FAMILY_BUNDLE",
        rules: JSON.stringify({ minMembers: 2, requiresHousehold: true, bundlePriceCents: 18000 }),
      },
    });

    const quote = await buildEnrollmentQuote(
      [
        { memberId: fx.adult.id, groupId: fx.adultBjj.id, planId: fx.bjjPlan.id },
        { memberId: fx.kid.id, groupId: fx.kidBjj.id, planId: fx.bjjPlan.id },
      ],
      offer.id,
    );

    expect(quote.blocked).toBe(true);
    expect(quote.warnings.join(" ")).toContain("même foyer");
  });

  it("applies family bundle for linked household members", async () => {
    const fx = await dojoFixture();
    const household = await prisma.household.create({ data: { label: "Famille Test" } });
    await prisma.householdMember.create({
      data: { householdId: household.id, memberId: fx.adult.id, relationship: "PARENT" },
    });
    await prisma.householdMember.create({
      data: { householdId: household.id, memberId: fx.kid.id, relationship: "CHILD" },
    });
    const offer = await prisma.offer.create({
      data: {
        name: "Famille",
        kind: "FAMILY_BUNDLE",
        rules: JSON.stringify({ minMembers: 2, requiresHousehold: true, bundlePriceCents: 18000 }),
      },
    });

    const quote = await buildEnrollmentQuote(
      [
        { memberId: fx.adult.id, groupId: fx.adultBjj.id, planId: fx.bjjPlan.id },
        { memberId: fx.kid.id, groupId: fx.kidBjj.id, planId: fx.bjjPlan.id },
      ],
      offer.id,
    );

    expect(quote.blocked).toBe(false);
    expect(quote.totalFinalCents).toBe(18000);
    expect(quote.totalDiscountCents).toBe(6000);
  });

  it("applies second discipline discount when student already has another active sport", async () => {
    const fx = await dojoFixture();
    await prisma.memberSubscription.create({
      data: {
        memberId: fx.adult.id,
        planId: fx.bjjPlan.id,
        sportId: fx.bjj.id,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 30 * 86400000),
        amount: fx.bjjPlan.price,
        remainingSessions: 10,
        status: "ACTIVE",
      },
    });
    const offer = await prisma.offer.create({
      data: {
        name: "2e discipline",
        kind: "SECOND_DISCIPLINE",
        rules: JSON.stringify({ percentOff: 25 }),
      },
    });

    const quote = await buildEnrollmentQuote(
      [{ memberId: fx.adult.id, groupId: fx.adultKarate.id, planId: fx.karatePlan.id }],
      offer.id,
    );

    expect(quote.blocked).toBe(false);
    expect(quote.lines[0].discountCents).toBe(2000);
    expect(quote.lines[0].finalAmountCents).toBe(6000);
  });

  it("expires stale subscriptions and resolves only active subscriptions", async () => {
    const fx = await dojoFixture();
    const sub = await prisma.memberSubscription.create({
      data: {
        memberId: fx.adult.id,
        planId: fx.bjjPlan.id,
        sportId: fx.bjj.id,
        startDate: new Date(Date.now() - 60 * 86400000),
        endDate: new Date(Date.now() - 86400000),
        amount: fx.bjjPlan.price,
        remainingSessions: 10,
        status: "ACTIVE",
      },
    });

    await expireStaleSubscriptions(fx.adult.id);
    const updated = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    const resolved = await resolveActiveSubscription(fx.adult.id, fx.bjj.id);

    expect(updated.status).toBe("EXPIRED");
    expect(resolved).toBeNull();
  });

  it("allows partial-payment check-in only when club setting permits it", async () => {
    const sub = {
      id: "sub",
      sportId: "sport",
      remainingSessions: 5,
      amount: 10000,
      totalPaid: 1000,
      plan: { sportId: "sport", sessionsPerWeek: null, name: "Plan" },
    };

    await prisma.clubSettings.update({
      where: { id: "default" },
      data: { allowCheckInWithPartialPayment: true },
    });
    await expect(canCheckInWithPayment(sub)).resolves.toEqual({ allowed: true });

    await prisma.clubSettings.update({
      where: { id: "default" },
      data: { allowCheckInWithPartialPayment: false },
    });
    const strict = await canCheckInWithPayment(sub);
    expect(strict.allowed).toBe(false);
  });
});

describe("additional enrollment and offer boundaries", () => {
  it("allows schedules that touch exactly and blocks a one-minute overlap", async () => {
    const fx = await dojoFixture();
    const noOverlap = await prisma.group.create({
      data: {
        name: "Adult BJJ No Overlap",
        groupType: "ADULTS",
        sportId: fx.bjj.id,
        coachId: fx.coach.id,
        capacity: 10,
        room: "Dojo E",
      },
    });
    await prisma.groupSchedule.create({
      data: {
        groupId: noOverlap.id,
        dayOfWeek: "MONDAY",
        startTime: "19:30",
        durationMinutes: 60,
      },
    });
    const oneMinuteOverlap = await prisma.group.create({
      data: {
        name: "Adult BJJ One Minute Overlap",
        groupType: "ADULTS",
        sportId: fx.bjj.id,
        coachId: fx.coach.id,
        capacity: 10,
        room: "Dojo F",
      },
    });
    await prisma.groupSchedule.create({
      data: {
        groupId: oneMinuteOverlap.id,
        dayOfWeek: "MONDAY",
        startTime: "19:29",
        durationMinutes: 60,
      },
    });

    const touchingQuote = await buildEnrollmentQuote([
      { memberId: fx.adult.id, groupId: fx.adultBjj.id, planId: fx.bjjPlan.id },
      { memberId: fx.adult.id, groupId: noOverlap.id, planId: fx.bjjPlan.id },
    ]);
    const overlappingQuote = await buildEnrollmentQuote([
      { memberId: fx.adult.id, groupId: fx.adultBjj.id, planId: fx.bjjPlan.id },
      { memberId: fx.adult.id, groupId: oneMinuteOverlap.id, planId: fx.bjjPlan.id },
    ]);

    expect(touchingQuote.blocked).toBe(false);
    expect(overlappingQuote.blocked).toBe(true);
  });

  it("ignores inactive offers", async () => {
    const fx = await dojoFixture();
    const offer = await prisma.offer.create({
      data: {
        name: "Inactive",
        kind: "PERCENT_OFF",
        isActive: false,
        rules: JSON.stringify({ percentOff: 50 }),
      },
    });

    const quote = await buildEnrollmentQuote(
      [{ memberId: fx.adult.id, groupId: fx.adultBjj.id, planId: fx.bjjPlan.id }],
      offer.id,
    );

    expect(quote.offerName).toBeNull();
    expect(quote.totalDiscountCents).toBe(0);
    expect(quote.totalFinalCents).toBe(fx.bjjPlan.price);
  });

  it("caps fixed discounts at the line price", async () => {
    const fx = await dojoFixture();
    const offer = await prisma.offer.create({
      data: {
        name: "Free line",
        kind: "FIXED_OFF",
        rules: JSON.stringify({ amountOffCents: 999999 }),
      },
    });

    const quote = await buildEnrollmentQuote(
      [{ memberId: fx.adult.id, groupId: fx.adultBjj.id, planId: fx.bjjPlan.id }],
      offer.id,
    );

    expect(quote.lines[0].discountCents).toBe(fx.bjjPlan.price);
    expect(quote.lines[0].finalAmountCents).toBe(0);
  });

  it("respects maxMembers on percent offers", async () => {
    const fx = await dojoFixture();
    const secondAdult = await prisma.member.create({
      data: {
        firstName: "Second",
        lastName: "Adult",
        phone: "adult-2",
        memberType: "ADULT",
      },
    });
    const offer = await prisma.offer.create({
      data: {
        name: "First member only",
        kind: "PERCENT_OFF",
        rules: JSON.stringify({ percentOff: 50, maxMembers: 1 }),
      },
    });

    const quote = await buildEnrollmentQuote(
      [
        { memberId: fx.adult.id, groupId: fx.adultBjj.id, planId: fx.bjjPlan.id },
        { memberId: secondAdult.id, groupId: fx.adultBjj.id, planId: fx.bjjPlan.id },
      ],
      offer.id,
    );

    expect(quote.lines[0].discountCents).toBe(6000);
    expect(quote.lines[1].discountCents).toBe(0);
  });
});

describe("api route scenarios", () => {
  it("rejects overpayment and accepts exact remaining payment", async () => {
    await signIn();
    const fx = await dojoFixture();
    const sub = await createActiveSubscription(fx, { amount: 10000 });
    await prisma.payment.create({
      data: { memberSubscriptionId: sub.id, amount: 7000 },
    });

    const overpay = await createPayment(
      jsonRequest("POST", {
        memberSubscriptionId: sub.id,
        amount: 4000,
      }),
    );
    expect(overpay.status).toBe(409);

    const exact = await createPayment(
      jsonRequest("POST", {
        memberSubscriptionId: sub.id,
        amount: 3000,
        paymentMethod: "CASH",
      }),
    );
    expect(exact.status).toBe(201);
    const totalPaid = await prisma.payment.aggregate({
      where: { memberSubscriptionId: sub.id },
      _sum: { amount: true },
    });
    expect(totalPaid._sum.amount).toBe(10000);
  });

  it("renews same-discipline subscriptions by expiring the old one and deriving server values", async () => {
    await signIn();
    const fx = await dojoFixture();
    const oldSub = await createActiveSubscription(fx, {
      amount: 1,
      remainingSessions: 1,
    });

    const response = await createMemberSubscription(
      jsonRequest("POST", {
        memberId: fx.adult.id,
        planId: fx.bjjPlan.id,
        startDate: new Date().toISOString(),
        amount: 1,
        remainingSessions: 1,
      }),
    );
    const body = await responseJson(response);
    const data = body.data as { id: string; amount: number; remainingSessions: number };
    const refreshedOld = await prisma.memberSubscription.findUniqueOrThrow({
      where: { id: oldSub.id },
    });

    expect(response.status).toBe(201);
    expect(refreshedOld.status).toBe("EXPIRED");
    expect(data.amount).toBe(fx.bjjPlan.price);
    expect(data.remainingSessions).toBe(fx.bjjPlan.totalSessions);
  });

  it("rejects deleting a linked sport and deletes an unused sport", async () => {
    await signIn();
    const fx = await dojoFixture();
    const linked = await deleteSport(jsonRequest("DELETE", { sportId: fx.bjj.id }));
    const unused = await prisma.sport.create({ data: { name: "Unused" } });
    const deleted = await deleteSport(jsonRequest("DELETE", { sportId: unused.id }));
    const deletedBody = await responseJson(deleted);

    expect(linked.status).toBe(409);
    expect(deleted.status).toBe(200);
    expect(deletedBody.data).toEqual({ id: unused.id });
  });

  it("decrements sessions for PRESENT, rejects duplicate attendance, and leaves ABSENT unchanged", async () => {
    await signIn();
    const fx = await dojoFixture();
    const sub = await createActiveSubscription(fx, { remainingSessions: 3 });
    await prisma.payment.create({
      data: { memberSubscriptionId: sub.id, amount: sub.amount },
    });
    const session = await createSessionForGroup(fx.adultBjj.id);
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date() },
    });

    const present = await createAttendance(
      jsonRequest("POST", {
        sessionId: session.id,
        memberId: fx.adult.id,
        status: "PRESENT",
      }),
    );
    const duplicate = await createAttendance(
      jsonRequest("POST", {
        sessionId: session.id,
        memberId: fx.adult.id,
        status: "PRESENT",
      }),
    );

    const secondSession = await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-05-20T18:00:00.000Z"),
    });
    const absent = await createAttendance(
      jsonRequest("POST", {
        sessionId: secondSession.id,
        memberId: fx.adult.id,
        status: "ABSENT",
      }),
    );
    const refreshed = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });

    expect(present.status).toBe(201);
    expect(duplicate.status).toBe(409);
    expect(absent.status).toBe(201);
    expect(refreshed.remainingSessions).toBe(2);
  });

  it("rejects normal check-in with no remaining sessions", async () => {
    await signIn();
    const fx = await dojoFixture();
    await createActiveSubscription(fx, { remainingSessions: 0 });
    const session = await createSessionForGroup(fx.adultBjj.id);
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date() },
    });

    const response = await createAttendance(
      jsonRequest("POST", {
        sessionId: session.id,
        memberId: fx.adult.id,
        status: "PRESENT",
      }),
    );
    const body = await responseJson(response);

    expect(response.status).toBe(403);
    expect(body.code).toBe("SUBSCRIPTION_INACTIVE");
  });

  it("enforces weekly attendance limit", async () => {
    await signIn();
    const fx = await dojoFixture();
    await prisma.subscriptionPlan.update({
      where: { id: fx.bjjPlan.id },
      data: { sessionsPerWeek: 1 },
    });
    const sub = await createActiveSubscription(fx, { remainingSessions: 5 });
    await prisma.payment.create({
      data: { memberSubscriptionId: sub.id, amount: sub.amount },
    });
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date() },
    });

    const monday = await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-05-18T18:00:00.000Z"),
    });
    const wednesday = await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-05-20T18:00:00.000Z"),
    });

    await createAttendance(
      jsonRequest("POST", {
        sessionId: monday.id,
        memberId: fx.adult.id,
        status: "PRESENT",
      }),
    );
    const second = await createAttendance(
      jsonRequest("POST", {
        sessionId: wednesday.id,
        memberId: fx.adult.id,
        status: "PRESENT",
      }),
    );
    const body = await responseJson(second);

    expect(second.status).toBe(403);
    expect(body.code).toBe("SUBSCRIPTION_WEEK_LIMIT_REACHED");
  });

  it("requires override reason and blocks the fourth override in 30 days", async () => {
    await signIn();
    const fx = await dojoFixture();
    const session = await createSessionForGroup(fx.adultBjj.id);

    const missingReason = await createAttendance(
      jsonRequest("POST", {
        sessionId: session.id,
        memberId: fx.adult.id,
        status: "OVERRIDE",
      }),
    );
    expect(missingReason.status).toBe(400);

    for (let i = 0; i < 3; i++) {
      const oldSession = await createSessionForGroup(fx.adultBjj.id, {
        sessionDate: new Date(`2026-05-${10 + i}T18:00:00.000Z`),
        startTime: `1${i}:00`,
        endTime: `1${i}:30`,
      });
      await prisma.attendance.create({
        data: {
          sessionId: oldSession.id,
          memberId: fx.adult.id,
          status: "OVERRIDE",
          overrideReason: "Manual exception",
        },
      });
    }

    const fourth = await createAttendance(
      jsonRequest("POST", {
        sessionId: session.id,
        memberId: fx.adult.id,
        status: "OVERRIDE",
        overrideReason: "Manager approved",
      }),
    );
    const body = await responseJson(fourth);

    expect(fourth.status).toBe(403);
    expect(body.code).toBe("OVERRIDE_LIMIT_REACHED");
  });
});

describe("admin permissions and password reset", () => {
  it("lets an admin create a limited staff account with selected permissions", async () => {
    await signIn("ADMIN");

    const response = await createUser(
      jsonRequest("POST", {
        name: "Limited Staff",
        email: "limited@test.local",
        password: "password123",
        role: "STAFF",
        accessMode: "LIMITED",
        permissions: ["members.manage", "payments.manage"],
      }),
    );
    const body = await responseJson(response);
    const data = body.data as { id: string; permissions: string[] };
    const rows = await prisma.userPermission.findMany({
      where: { userId: data.id },
      orderBy: { key: "asc" },
    });

    expect(response.status).toBe(201);
    expect(data.permissions.sort()).toEqual(["members.manage", "payments.manage"]);
    expect(rows.map((row) => row.key).sort()).toEqual(["members.manage", "payments.manage"]);
  });

  it("creates a reset token, changes the password, and prevents token reuse", async () => {
    const user = await prisma.user.create({
      data: {
        name: "Reset User",
        email: "reset@test.local",
        role: "STAFF",
        passwordHash: await hashPassword("old-password"),
      },
    });

    const forgotResponse = await requestPasswordReset(
      jsonRequest("POST", { email: user.email }),
    );
    const forgotBody = await responseJson(forgotResponse);
    const resetUrl = (forgotBody.data as { resetUrl: string }).resetUrl;
    const token = new URL(resetUrl).searchParams.get("token");

    expect(forgotResponse.status).toBe(200);
    expect(token).toBeTruthy();

    const resetResponse = await resetPassword(
      jsonRequest("POST", { token, password: "new-password" }),
    );
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const reused = await resetPassword(
      jsonRequest("POST", { token, password: "new-password-2" }),
    );

    expect(resetResponse.status).toBe(200);
    await expect(verifyPassword("new-password", updated.passwordHash)).resolves.toBe(true);
    expect(reused.status).toBe(400);
  });

  it("lets admin update club settings and blocks staff", async () => {
    await signIn("ADMIN");
    const adminRes = await patchClubSettings(
      jsonRequest("PATCH", {
        clubName: "Club Test",
        clubLogoUrl: "/branding/club-logo-test.png",
        allowCheckInWithPartialPayment: false,
        allowCheckInWithoutSubscription: false,
        maxStaffDiscountPercent: 25,
        debtAlertThresholdCents: 1500,
      }),
    );
    const adminBody = await responseJson(adminRes);
    const settings = await prisma.clubSettings.findUniqueOrThrow({ where: { id: "default" } });

    expect(adminRes.status).toBe(200);
    expect((adminBody.data as { maxStaffDiscountPercent: number }).maxStaffDiscountPercent).toBe(25);
    expect(settings.clubName).toBe("Club Test");
    expect(settings.clubLogoUrl).toBe("/branding/club-logo-test.png");
    expect(settings.allowCheckInWithPartialPayment).toBe(false);
    expect(settings.allowCheckInWithoutSubscription).toBe(false);
    expect(settings.maxStaffDiscountPercent).toBe(25);
    expect(settings.debtAlertThresholdCents).toBe(1500);

    await signIn("STAFF");
    const staffRes = await patchClubSettings(
      jsonRequest("PATCH", { maxStaffDiscountPercent: 10 }),
    );
    expect(staffRes.status).toBe(403);

    await prisma.clubSettings.update({
      where: { id: "default" },
      data: {
        clubName: "",
        clubLogoUrl: "",
        allowCheckInWithPartialPayment: true,
        allowCheckInWithoutSubscription: true,
        maxStaffDiscountPercent: 30,
        debtAlertThresholdCents: 0,
      },
    });
  });
});

