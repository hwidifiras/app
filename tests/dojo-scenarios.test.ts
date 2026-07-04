import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ token: null as string | null }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (authState.token ? { value: authState.token } : undefined),
  }),
}));

import { prisma } from "@/lib/prisma";
import { POST as createAttendance, PATCH as patchAttendance, DELETE as deleteAttendance } from "@/app/api/attendances/route";
import { POST as createPayment, PATCH as patchPayment, DELETE as deletePayment } from "@/app/api/payments/route";
import { DELETE as archiveMember } from "@/app/api/members/route";
import { DELETE as deleteMemberDetail } from "@/app/api/members/[id]/route";
import { PATCH as postponeSession } from "@/app/api/sessions/[id]/postpone/route";
import { POST as finalizeSession } from "@/app/api/attendances/sessions/[id]/finalize/route";
import { PATCH as patchSession, DELETE as deleteSession } from "@/app/api/sessions/[id]/route";
import { DELETE as deleteSport } from "@/app/api/sports/route";
import { DELETE as deleteSubscriptionPlan, POST as createSubscriptionPlan } from "@/app/api/subscription-plans/route";
import { POST as applyEnrollment } from "@/app/api/enrollment/apply/route";
import { POST as revertEnrollment } from "@/app/api/enrollment/revert/route";
import {
  DELETE as deleteMemberSubscription,
  PATCH as patchMemberSubscription,
  POST as createMemberSubscription,
} from "@/app/api/member-subscriptions/route";
import { DELETE as bulkCloseGroupMembers, POST as bulkCreateGroupMembers } from "@/app/api/group-members/bulk/route";
import { DELETE as closeGroupMember } from "@/app/api/group-members/route";
import { PATCH as patchClubSettings } from "@/app/api/club-settings/route";
import { POST as createUser } from "@/app/api/users/route";
import { POST as requestPasswordReset } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { GET as getAuthMe } from "@/app/api/auth/me/route";
import { signAuthToken, type AuthRole } from "@/lib/auth";
import { resetRateLimitsForTests } from "@/lib/rate-limit";
import { hashPassword, verifyPassword } from "@/lib/password";
import { FULL_STAFF_PERMISSIONS } from "@/lib/permission-definitions";
import {
  buildEnrollmentQuote,
  canCheckInWithPayment,
  expireStaleSubscriptions,
  resolveActiveSubscription,
} from "@/lib/membership-rules";
import { enrollmentQuoteSchema } from "@/lib/schemas/enrollment";
import { createGroupSchema } from "@/lib/schemas/group";
import { createSubscriptionPlanSchema } from "@/lib/schemas/subscription-plan";
import { DELETE as deactivateGroup, PATCH as patchGroup, POST as createGroup } from "@/app/api/groups/route";
import { validateSessionSlot } from "@/lib/session-slot-conflict";
import {
  sessionAdjustmentDelta,
  statusConsumesSession,
} from "@/lib/attendance-session-adjustment";
import {
  computeWeeklyAllowanceRemainingForMember,
  consumptionUnitsForSessionSlot,
  getWeeklyConsumptionMode,
  loadGroupWeekSessions,
  loadWeekAttendanceStatuses,
  simulateWeeklyAllowanceRemaining,
} from "@/lib/weekly-session-consumption";
import { getGroupWeeklyScheduleCount } from "@/lib/sport-weekly-standard";
import {
  applyDataImport,
  inspectDataImport,
  rollbackDataImport,
} from "@/lib/data-import-service";
import { previewBulkDataImport } from "@/lib/bulk-data-import";
import type { DataImportPayload } from "@/lib/schemas/data-import";
import { getWeekRangeUtc } from "@/lib/dates";
import { setFallbackTenantContext } from "@/lib/tenant-context";

const TEST_TENANT_ID = "tenant_test";
const TEST_TENANT_SLUG = "we-discipline";

setFallbackTenantContext({ tenantId: TEST_TENANT_ID, tenantSlug: TEST_TENANT_SLUG, host: "test.local" });

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
  await prisma.tenant.upsert({
    where: { slug: TEST_TENANT_SLUG },
    create: {
      id: TEST_TENANT_ID,
      slug: TEST_TENANT_SLUG,
      name: "Test Tenant",
      rootDomainAlias: "test.local",
    },
    update: { status: "ACTIVE" },
  });
  await prisma.clubSettings.create({
    data: {
      id: "default",
      tenantId: TEST_TENANT_ID,
      allowCheckInWithPartialPayment: true,
      allowCheckInWithoutSubscription: false,
      absentConsumesSession: true,
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
  const userId = `${role.toLowerCase()}-test-user`;
  const email = `${role.toLowerCase()}@test.local`;
  const name = `${role} Test`;
  const permissions = role === "STAFF" ? FULL_STAFF_PERMISSIONS : [];
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: TEST_TENANT_ID, email } },
    update: {
      name,
      role,
      isActive: true,
      passwordHash: await hashPassword("password123"),
      permissions: {
        deleteMany: {},
        create: permissions.map((key) => ({ tenantId: TEST_TENANT_ID, key })),
      },
    },
    create: {
      id: userId,
      tenantId: TEST_TENANT_ID,
      email,
      name,
      role,
      passwordHash: await hashPassword("password123"),
      permissions: {
        create: permissions.map((key) => ({ tenantId: TEST_TENANT_ID, key })),
      },
    },
  });

  authState.token = await signAuthToken({
    userId: user.id,
    tenantId: TEST_TENANT_ID,
    tenantSlug: TEST_TENANT_SLUG,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions,
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

function routeWithSessionId(
  handler: (request: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>,
  sessionId: string,
  method: string,
  body: unknown,
) {
  return handler(jsonRequest(method, body), { params: Promise.resolve({ id: sessionId }) });
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
      tenantId: TEST_TENANT_ID,
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
  overrides: Partial<{ sessionDate: Date; startTime: string; endTime: string; room: string; coachId: string | null }> = {},
) {
  const group =
    overrides.coachId === undefined || overrides.room === undefined
      ? await prisma.group.findUniqueOrThrow({
          where: { id: groupId },
          select: { coachId: true, room: true },
        })
      : null;

  return prisma.session.create({
    data: {
      tenantId: TEST_TENANT_ID,
      groupId,
      sessionDate: overrides.sessionDate ?? new Date("2026-05-18T18:00:00.000Z"),
      startTime: overrides.startTime ?? "18:00",
      endTime: overrides.endTime ?? "19:30",
      room: overrides.room ?? group?.room ?? "Dojo A",
      coachId: overrides.coachId !== undefined ? overrides.coachId : (group?.coachId ?? null),
      status: "PLANNED",
    },
  });
}

async function setupTwoPerWeekPlanWithThreeSessions(fx: Awaited<ReturnType<typeof dojoFixture>>) {
  await prisma.groupSchedule.createMany({
    data: [
      { tenantId: TEST_TENANT_ID, groupId: fx.adultBjj.id, dayOfWeek: "WEDNESDAY", startTime: "18:00", durationMinutes: 90 },
      { tenantId: TEST_TENANT_ID, groupId: fx.adultBjj.id, dayOfWeek: "FRIDAY", startTime: "18:00", durationMinutes: 90 },
    ],
  });

  const plan = await prisma.subscriptionPlan.create({
    data: {
      tenantId: TEST_TENANT_ID,
      name: "BJJ 2/sem",
      price: 3500,
      sessionsPerWeek: 2,
      totalSessions: 8,
      validityDays: 30,
      sportId: fx.bjj.id,
    },
  });

  const sessions = [
    await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-05-18T00:00:00.000Z"),
    }),
    await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-05-20T00:00:00.000Z"),
    }),
    await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-05-22T00:00:00.000Z"),
    }),
  ] as const;

  return { plan, sessions };
}

async function enrollMemberForContextualPlan(
  fx: Awaited<ReturnType<typeof dojoFixture>>,
  planId: string,
  remainingSessions = 8,
) {
  const sub = await createActiveSubscription(fx, { planId, remainingSessions, amount: 3500 });
  await prisma.payment.create({ data: { tenantId: TEST_TENANT_ID, memberSubscriptionId: sub.id, amount: sub.amount } });
  await prisma.groupMember.create({
    data: {
      tenantId: TEST_TENANT_ID,
      groupId: fx.adultBjj.id,
      memberId: fx.adult.id,
      startDate: new Date("2026-05-01T00:00:00.000Z"),
    },
  });
  return sub;
}

async function weeklyAllowanceLeft(
  subId: string,
  memberId: string,
  session: { id: string; sessionDate: Date },
  groupId: string,
  planSessionsPerWeek: number,
) {
  return computeWeeklyAllowanceRemainingForMember({
    sessionId: session.id,
    groupId,
    sessionDate: session.sessionDate,
    memberId,
    memberSubscriptionId: subId,
    planSessionsPerWeek,
    absentConsumesSession: true,
  });
}

async function weeklyAllowanceAfterWeek(
  subId: string,
  memberId: string,
  sessionDate: Date,
  groupId: string,
  planSessionsPerWeek: number,
) {
  const groupWeeklySessions = await getGroupWeeklyScheduleCount(groupId);
  const planAllowance = planSessionsPerWeek ?? groupWeeklySessions;
  const mode = getWeeklyConsumptionMode(planSessionsPerWeek, groupWeeklySessions);
  const sessionsInWeek = await loadGroupWeekSessions(groupId, sessionDate);
  const attendancesBySessionId = await loadWeekAttendanceStatuses({
    memberId,
    memberSubscriptionId: subId,
    groupId,
    sessionDate,
  });

  return simulateWeeklyAllowanceRemaining({
    planAllowance,
    mode,
    sessionsInWeek,
    attendancesBySessionId,
    absentConsumesSession: true,
  });
}

function buildDataImportPayload(
  fx: Awaited<ReturnType<typeof dojoFixture>>,
  sessionId: string,
  overrides: Partial<DataImportPayload> = {},
): DataImportPayload {
  const cutover = new Date();
  const subscriptionStart = new Date(cutover);
  subscriptionStart.setUTCDate(subscriptionStart.getUTCDate() - 10);
  const subscriptionEnd = new Date(cutover);
  subscriptionEnd.setUTCDate(subscriptionEnd.getUTCDate() + 20);

  return {
    cutoverDate: cutover.toISOString(),
    member: {
      firstName: "Mouna",
      lastName: "Reprise",
      phone: "import-unique-phone",
      email: "mouna@example.com",
      memberType: "ADULT",
      birthDate: "",
      address: "",
      parentName: "",
      parentPhone: "",
      joinedAt: subscriptionStart.toISOString(),
    },
    groupId: fx.adultBjj.id,
    planId: fx.bjjPlan.id,
    assignmentStartDate: subscriptionStart.toISOString(),
    subscriptionStartDate: subscriptionStart.toISOString(),
    subscriptionEndDate: subscriptionEnd.toISOString(),
    amountCents: 12000,
    paidCents: 5000,
    remainingSessions: 7,
    paymentDate: cutover.toISOString(),
    paymentMethod: "REPRISE_PAPIER",
    note: "Reprise depuis le registre papier",
    attendances: [{ sessionId, status: "PRESENT" }],
    ...overrides,
  };
}

beforeEach(async () => {
  authState.token = null;
  resetRateLimitsForTests();
  await resetData();
});

describe("temporary data import", () => {
  it("generates a member code when the import file has no code column", async () => {
    const fx = await dojoFixture();
    const rows = [
      [
        "Prénom",
        "Nom",
        "Type membre",
        "Téléphone",
        "Téléphone parent",
        "Date inscription",
        "Groupe",
        "Formule",
        "Début abonnement",
        "Fin abonnement",
        "Montant total",
        "Déjà payé",
        "Séances restantes",
      ],
      ["", "", "", "", "", "", "", "", "", "", "", "", ""],
      [
        "Amine",
        "Client",
        "Adulte",
        "0612349999",
        "",
        "2026-06-01",
        fx.adultBjj.name,
        fx.bjjPlan.name,
        "2026-06-01",
        "2026-07-01",
        "120",
        "20",
        "7",
      ],
    ];
    const csv = rows.map((row) => row.join(";")).join("\n");

    const result = await previewBulkDataImport(Buffer.from(csv, "utf8"), "reprise.csv", "2026-06-15");

    expect(result.errorRows).toBe(0);
    expect(result.rows[0].externalId).toBe("M001-amineclient-9999");
  });

  it("ignores legacy code columns and keeps the French import headers", async () => {
    const fx = await dojoFixture();
    const rows = [
      [
        "Code membre auto",
        "Prénom",
        "Nom",
        "Type membre",
        "Téléphone",
        "Téléphone parent",
        "Date inscription",
        "Groupe",
        "Formule",
        "Début abonnement",
        "Fin abonnement",
        "Montant total",
        "Déjà payé",
        "Séances restantes",
      ],
      [
        "CLIENT-OLD-42",
        "Nour",
        "Client",
        "Enfant",
        "",
        "0612348888",
        "2026-06-01",
        fx.adultBjj.name,
        fx.bjjPlan.name,
        "2026-06-01",
        "2026-07-01",
        "120",
        "20",
        "7",
      ],
    ];
    const csv = rows.map((row) => row.join(";")).join("\n");

    const result = await previewBulkDataImport(Buffer.from(csv, "utf8"), "reprise.csv", "2026-06-15");

    expect(result.errorRows).toBe(0);
    expect(result.rows[0].externalId).toBe("M001-nourclient-8888");
  });

  it("imports the member state atomically without consuming the paper attendance twice", async () => {
    const fx = await dojoFixture();
    const { start } = getWeekRangeUtc(new Date());
    const session = await createSessionForGroup(fx.adultBjj.id, { sessionDate: start });
    const payload = buildDataImportPayload(fx, session.id);

    const inspection = await inspectDataImport(payload);
    const result = await applyDataImport(payload, "admin-import");

    const member = await prisma.member.findUniqueOrThrow({
      where: { id: result.memberId },
      include: {
        groups: true,
        subscriptions: { include: { payments: true, attendances: true } },
      },
    });

    expect(inspection.inspection.remainingBalanceCents).toBe(7000);
    expect(member.groups).toHaveLength(1);
    expect(member.subscriptions).toHaveLength(1);
    expect(member.subscriptions[0].remainingSessions).toBe(7);
    expect(member.subscriptions[0].payments[0].amount).toBe(5000);
    expect(member.subscriptions[0].attendances[0].status).toBe("PRESENT");
  });

  it("rolls back a fresh import completely", async () => {
    const fx = await dojoFixture();
    const { start } = getWeekRangeUtc(new Date());
    const session = await createSessionForGroup(fx.adultBjj.id, { sessionDate: start });
    const result = await applyDataImport(buildDataImportPayload(fx, session.id), "admin-import");

    await rollbackDataImport(result.auditLogId, "admin-import");

    expect(await prisma.member.findUnique({ where: { id: result.memberId } })).toBeNull();
    expect(
      await prisma.auditLog.findFirst({
        where: { action: "DATA_IMPORT_ROLLED_BACK", entityId: result.memberId },
      }),
    ).not.toBeNull();
  });

  it("refuses rollback after new activity is attached to the imported subscription", async () => {
    const fx = await dojoFixture();
    const { start } = getWeekRangeUtc(new Date());
    const session = await createSessionForGroup(fx.adultBjj.id, { sessionDate: start });
    const result = await applyDataImport(buildDataImportPayload(fx, session.id), "admin-import");
    const subscription = await prisma.memberSubscription.findFirstOrThrow({
      where: { memberId: result.memberId },
    });
    await prisma.payment.create({
      data: { memberSubscriptionId: subscription.id, amount: 100, paymentMethod: "CASH" },
    });

    await expect(rollbackDataImport(result.auditLogId, "admin-import")).rejects.toThrow(
      "IMPORT_HAS_NEW_ACTIVITY",
    );
    expect(await prisma.member.findUnique({ where: { id: result.memberId } })).not.toBeNull();
  });
});

describe("schema guardrails", () => {
  it("requires a discipline on every subscription plan", () => {
    const parsed = createSubscriptionPlanSchema.safeParse({
      name: "Mensuel",
      price: 3500,
      sessionsPerWeek: 3,
      validityDays: 30,
    });

    expect(parsed.success).toBe(false);
  });

  it("derives monthly sessions from weekly frequency", () => {
    const parsed = createSubscriptionPlanSchema.safeParse({
      name: "Mensuel",
      price: 3500,
      sessionsPerWeek: 3,
      validityDays: 30,
      sportId: "sport-id",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.totalSessions).toBe(12);
      expect(parsed.data.sessionsPerWeek).toBe(3);
    }
  });

  it("allows creating a group without a default room", () => {
    const parsed = createGroupSchema.safeParse({
      name: "Groupe sans salle",
      groupType: "ADULTS",
      sportId: "sport-id",
      coachId: "coach-id",
      capacity: 12,
    });

    expect(parsed.success).toBe(true);
  });

  it("requires parent name and phone when enrolling a new child", async () => {
    const fx = await dojoFixture();

    const parsed = enrollmentQuoteSchema.safeParse({
      lines: [
        {
          newMember: {
            firstName: "Child",
            lastName: "No Parent",
            memberType: "KID",
          },
          groupId: fx.kidBjj.id,
          planId: fx.bjjPlan.id,
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("allows enrolling a child without their own phone when parent phone is provided", async () => {
    const fx = await dojoFixture();

    const parsed = enrollmentQuoteSchema.safeParse({
      lines: [
        {
          newMember: {
            firstName: "Child",
            lastName: "With Parent",
            memberType: "KID",
            parentName: "Parent Name",
            parentPhone: "0612345678",
          },
          groupId: fx.kidBjj.id,
          planId: fx.bjjPlan.id,
        },
      ],
    });

    expect(parsed.success).toBe(true);
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
        data: { groupId: fx.adultBjj.id, memberId: member.id, startDate: new Date("2026-05-01T00:00:00.000Z") },
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
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z") },
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
    expect(quote.warnings.join(" ")).toMatch(/foyer/i);
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
    expect(quote.lines.every((l) => !l.reusesExistingSubscription)).toBe(true);
  });

  it("persists family bundle pricing when enrolling existing members who already had active subscriptions", async () => {
    await signIn();
    const fx = await dojoFixture();
    const household = await prisma.household.create({ data: { label: "Famille" } });
    await prisma.householdMember.create({
      data: { householdId: household.id, memberId: fx.adult.id, relationship: "PARENT" },
    });
    await prisma.householdMember.create({
      data: { householdId: household.id, memberId: fx.kid.id, relationship: "CHILD" },
    });
    await prisma.subscriptionPlan.update({
      where: { id: fx.bjjPlan.id },
      data: { price: 3500 },
    });
    await createActiveSubscription(fx, { memberId: fx.adult.id, amount: 3500 });
    await createActiveSubscription(fx, { memberId: fx.kid.id, amount: 3500 });

    const offer = await prisma.offer.create({
      data: {
        name: "Mère et fille",
        kind: "FAMILY_BUNDLE",
        rules: JSON.stringify({ minMembers: 2, requiresHousehold: true, bundlePriceCents: 5000 }),
      },
    });

    const response = await applyEnrollment(
      jsonRequest("POST", {
        offerId: offer.id,
        lines: [
          {
            memberId: fx.adult.id,
            groupId: fx.adultBjj.id,
            planId: fx.bjjPlan.id,
            paymentCents: 2500,
          },
          {
            memberId: fx.kid.id,
            groupId: fx.kidBjj.id,
            planId: fx.bjjPlan.id,
            paymentCents: 2500,
          },
        ],
      }),
    );

    expect(response.status).toBe(201);

    const subs = await prisma.memberSubscription.findMany({
      where: { memberId: { in: [fx.adult.id, fx.kid.id] }, status: "ACTIVE" },
    });
    expect(subs).toHaveLength(2);
    for (const sub of subs) {
      expect(sub.amount).toBe(2500);
      expect(sub.listPriceCents).toBe(3500);
      expect(sub.discountCents).toBe(1000);
      expect(sub.offerName).toBe("Mère et fille");
      expect(sub.offerApplicationId).toBeTruthy();
    }
  });

  it("applies family bundle for two new members in the same quote", async () => {
    const fx = await dojoFixture();
    const offer = await prisma.offer.create({
      data: {
        name: "Famille nouveaux",
        kind: "FAMILY_BUNDLE",
        rules: JSON.stringify({ minMembers: 2, requiresHousehold: true, bundlePriceCents: 18000 }),
      },
    });

    const quote = await buildEnrollmentQuote(
      [
        {
          newMember: {
            firstName: "Parent",
            lastName: "Un",
            phone: "new-adult-1",
            memberType: "ADULT",
          },
          groupId: fx.adultBjj.id,
          planId: fx.bjjPlan.id,
        },
        {
          newMember: {
            firstName: "Parent",
            lastName: "Deux",
            phone: "new-adult-2",
            memberType: "ADULT",
          },
          groupId: fx.adultBjj.id,
          planId: fx.bjjPlan.id,
        },
      ],
      offer.id,
    );

    expect(quote.blocked).toBe(false);
    expect(quote.totalFinalCents).toBe(18000);
    expect(quote.warnings.join(" ")).not.toContain("même foyer");
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

describe("session double booking", () => {
  it("blocks coach overlap across groups but allows touching slots", async () => {
    const fx = await dojoFixture();
    const sessionDate = new Date("2026-05-18T18:00:00.000Z");

    await createSessionForGroup(fx.adultBjj.id, {
      sessionDate,
      startTime: "18:00",
      endTime: "19:30",
      coachId: fx.coach.id,
      room: "Dojo A",
    });

    const overlapError = await validateSessionSlot({
      groupId: fx.adultKarate.id,
      groupName: fx.adultKarate.name,
      sessionDate,
      startTime: "19:00",
      endTime: "20:00",
      coachId: fx.coach.id,
      room: "Dojo D",
      excludeIds: [],
    });

    expect(overlapError).toMatch(/coach/i);

    const touchingError = await validateSessionSlot({
      groupId: fx.adultKarate.id,
      groupName: fx.adultKarate.name,
      sessionDate,
      startTime: "19:30",
      endTime: "20:30",
      coachId: fx.coach.id,
      room: "Dojo D",
      excludeIds: [],
    });

    expect(touchingError).toBeNull();
  });

  it("blocks room overlap across groups", async () => {
    const fx = await dojoFixture();
    const sessionDate = new Date("2026-05-18T18:00:00.000Z");

    await createSessionForGroup(fx.adultBjj.id, {
      sessionDate,
      startTime: "18:00",
      endTime: "19:30",
      coachId: fx.coach.id,
      room: "Dojo A",
    });

    const roomError = await validateSessionSlot({
      groupId: fx.adultKarate.id,
      groupName: fx.adultKarate.name,
      sessionDate,
      startTime: "18:30",
      endTime: "19:30",
      coachId: null,
      room: "Dojo A",
      excludeIds: [],
    });

    expect(roomError).toMatch(/salle/i);
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
        startDate: new Date("2026-05-01T00:00:00.000Z").toISOString(),
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

  it("carries over remaining sessions when renewing with carryOverRemainingSessions", async () => {
    await signIn();
    const fx = await dojoFixture();
    await createActiveSubscription(fx, { remainingSessions: 4 });

    const response = await createMemberSubscription(
      jsonRequest("POST", {
        memberId: fx.adult.id,
        planId: fx.bjjPlan.id,
        startDate: new Date("2026-05-01T00:00:00.000Z").toISOString(),
        carryOverRemainingSessions: true,
      }),
    );
    const body = await responseJson(response);
    const data = body.data as { remainingSessions: number };

    expect(response.status).toBe(201);
    expect(data.remainingSessions).toBe(fx.bjjPlan.totalSessions + 4);
  });

  it("requires adjustmentReason when admin changes amount or remaining sessions", async () => {
    await signIn("ADMIN");
    const fx = await dojoFixture();
    const sub = await createActiveSubscription(fx);

    const missingReason = await patchMemberSubscription(
      jsonRequest("PATCH", {
        subscriptionId: sub.id,
        payload: { remainingSessions: 5 },
      }),
    );
    expect(missingReason.status).toBe(400);

    const withReason = await patchMemberSubscription(
      jsonRequest("PATCH", {
        subscriptionId: sub.id,
        payload: { remainingSessions: 5, adjustmentReason: "Correction compteur réception" },
      }),
    );
    const body = await responseJson(withReason);
    const data = body.data as { remainingSessions: number };

    expect(withReason.status).toBe(200);
    expect(data.remainingSessions).toBe(5);
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

  it("rejects deleting a linked subscription plan and deletes an unused plan", async () => {
    await signIn();
    const fx = await dojoFixture();
    await createActiveSubscription(fx);

    const linked = await deleteSubscriptionPlan(jsonRequest("DELETE", { planId: fx.bjjPlan.id }));
    const linkedBody = await responseJson(linked);

    const unused = await prisma.subscriptionPlan.create({
      data: {
        name: `Unused plan ${Date.now()}`,
        price: 10000,
        totalSessions: 8,
        validityDays: 30,
        sportId: fx.bjj.id,
      },
    });
    const deleted = await deleteSubscriptionPlan(jsonRequest("DELETE", { planId: unused.id }));
    const deletedBody = await responseJson(deleted);

    expect(linked.status).toBe(409);
    expect(String(linkedBody.error)).toMatch(/encore utilisée/i);
    expect(deleted.status).toBe(200);
    expect(deletedBody.data).toEqual({ id: unused.id });
  });

  it("decrements sessions for PRESENT and ABSENT, rejects duplicate attendance", async () => {
    await signIn();
    const fx = await dojoFixture();
    const sub = await createActiveSubscription(fx, { remainingSessions: 3 });
    await prisma.payment.create({
      data: { memberSubscriptionId: sub.id, amount: sub.amount },
    });
    const session = await createSessionForGroup(fx.adultBjj.id);
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z") },
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
    expect(refreshed.remainingSessions).toBe(1);
  });

  it("allows attendance when assignment and subscription start later on the session day", async () => {
    await signIn();
    const fx = await dojoFixture();
    const sessionDay = new Date("2026-06-24T00:00:00.000Z");
    const laterSameDay = new Date("2026-06-24T12:00:00.000Z");
    const sub = await createActiveSubscription(fx, {
      remainingSessions: 3,
      startDate: laterSameDay,
      endDate: new Date("2026-07-24T00:00:00.000Z"),
    });
    await prisma.payment.create({ data: { memberSubscriptionId: sub.id, amount: sub.amount } });
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: laterSameDay },
    });
    const session = await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: sessionDay,
      startTime: "18:00",
      endTime: "19:30",
    });

    const response = await createAttendance(
      jsonRequest("POST", {
        sessionId: session.id,
        memberId: fx.adult.id,
        status: "PRESENT",
      }),
    );

    expect(response.status).toBe(201);
  });

  it("does not decrement sessions for ABSENT when absentConsumesSession is disabled", async () => {
    await signIn();
    const fx = await dojoFixture();
    await prisma.clubSettings.update({
      where: { id: "default" },
      data: { absentConsumesSession: false },
    });
    const sub = await createActiveSubscription(fx, { remainingSessions: 3 });
    await prisma.payment.create({
      data: { memberSubscriptionId: sub.id, amount: sub.amount },
    });
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z") },
    });
    const session = await createSessionForGroup(fx.adultBjj.id);

    const absent = await createAttendance(
      jsonRequest("POST", {
        sessionId: session.id,
        memberId: fx.adult.id,
        status: "ABSENT",
      }),
    );
    const refreshed = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });

    expect(absent.status).toBe(201);
    expect(refreshed.remainingSessions).toBe(3);
  });

  it("allows recovery check-in on another equivalent group after an absence", async () => {
    await signIn();
    const fx = await dojoFixture();
    const sub = await createActiveSubscription(fx, { remainingSessions: 4 });
    await prisma.payment.create({
      data: { memberSubscriptionId: sub.id, amount: sub.amount },
    });

    const absentSession = await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-05-18T18:00:00.000Z"),
    });
    const recoverySession = await createSessionForGroup(fx.adultBjjOverlap.id, {
      sessionDate: new Date("2026-05-20T18:00:00.000Z"),
      startTime: "18:30",
      endTime: "19:30",
      room: "Dojo B",
    });

    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z") },
    });

    const absent = await createAttendance(
      jsonRequest("POST", {
        sessionId: absentSession.id,
        memberId: fx.adult.id,
        status: "ABSENT",
      }),
    );
    expect(absent.status).toBe(201);

    const afterAbsent = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(afterAbsent.remainingSessions).toBe(3);

    const recovery = await createAttendance(
      jsonRequest("POST", {
        sessionId: recoverySession.id,
        memberId: fx.adult.id,
        status: "OVERRIDE",
        overrideKind: "RECOVERY",
        overrideReason: "Créneau proposé",
      }),
    );
    expect(recovery.status).toBe(201);

    const afterRecovery = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(afterRecovery.remainingSessions).toBe(3);
  });

  it("rejects normal check-in with no remaining sessions", async () => {
    await signIn();
    const fx = await dojoFixture();
    await createActiveSubscription(fx, { remainingSessions: 0 });
    const session = await createSessionForGroup(fx.adultBjj.id);
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z") },
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
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z") },
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
    const sub = await createActiveSubscription(fx, { remainingSessions: 10 });
    await prisma.payment.create({
      data: { memberSubscriptionId: sub.id, amount: sub.amount },
    });
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z") },
    });
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

  it("returns ok without sending when forgot-password email is unknown", async () => {
    const response = await requestPasswordReset(
      jsonRequest("POST", { email: "nobody@test.local" }),
    );
    const body = await responseJson(response);
    const auditCount = await prisma.auditLog.count({
      where: { action: "PASSWORD_RESET_REQUESTED" },
    });

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ ok: true });
    expect(auditCount).toBe(0);
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
        allowCheckInWithoutSubscription: false,
        absentConsumesSession: true,
        maxStaffDiscountPercent: 30,
        debtAlertThresholdCents: 0,
      },
    });
  });

  it("blocks staff without payments.manage from recording payments", async () => {
    const staff = await prisma.user.create({
      data: {
        tenantId: TEST_TENANT_ID,
        name: "Members Only",
        email: "members-only@test.local",
        role: "STAFF",
        passwordHash: await hashPassword("password123"),
        permissions: { create: [{ tenantId: TEST_TENANT_ID, key: "members.manage" }] },
      },
    });
    authState.token = await signAuthToken({
      userId: staff.id,
      tenantId: TEST_TENANT_ID,
      tenantSlug: TEST_TENANT_SLUG,
      email: staff.email,
      name: staff.name,
      role: "STAFF",
      permissions: ["members.manage"],
    });

    const fx = await dojoFixture();
    const sub = await createActiveSubscription(fx);
    const response = await createPayment(
      jsonRequest("POST", {
        memberSubscriptionId: sub.id,
        amount: 1000,
      }),
    );

    expect(response.status).toBe(403);
  });
});

describe("attendance session balance corrections", () => {
  it("computes session adjustment deltas consistently", () => {
    expect(sessionAdjustmentDelta("PRESENT", "OVERRIDE", true)).toBe(1);
    expect(sessionAdjustmentDelta("OVERRIDE", "PRESENT", true)).toBe(-1);
    expect(sessionAdjustmentDelta("PRESENT", "ABSENT", false)).toBe(1);
    expect(sessionAdjustmentDelta("ABSENT", "PRESENT", true)).toBe(0);
    expect(statusConsumesSession("ABSENT", false)).toBe(false);
  });

  it("credits sessions when correcting PRESENT to OVERRIDE", async () => {
    await signIn();
    const fx = await dojoFixture();
    const sub = await createActiveSubscription(fx, { remainingSessions: 5 });
    await prisma.payment.create({ data: { memberSubscriptionId: sub.id, amount: sub.amount } });
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z") },
    });
    const session = await createSessionForGroup(fx.adultBjj.id);
    const created = await createAttendance(
      jsonRequest("POST", { sessionId: session.id, memberId: fx.adult.id, status: "PRESENT" }),
    );
    const createdBody = await responseJson(created);
    const attendanceId = (createdBody.data as { id: string }).id;

    const patched = await patchAttendance(
      jsonRequest("PATCH", {
        attendanceId,
        payload: { status: "OVERRIDE", overrideReason: "Correction erreur réception" },
      }),
    );
    const refreshed = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });

    expect(patched.status).toBe(200);
    expect(refreshed.remainingSessions).toBe(5);
  });

  it("credits sessions when correcting PRESENT to ABSENT if absences do not consume sessions", async () => {
    await signIn();
    const fx = await dojoFixture();
    await prisma.clubSettings.update({
      where: { id: "default" },
      data: { absentConsumesSession: false },
    });
    const sub = await createActiveSubscription(fx, { remainingSessions: 4 });
    await prisma.payment.create({ data: { memberSubscriptionId: sub.id, amount: sub.amount } });
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z") },
    });
    const session = await createSessionForGroup(fx.adultBjj.id);
    const created = await createAttendance(
      jsonRequest("POST", { sessionId: session.id, memberId: fx.adult.id, status: "PRESENT" }),
    );
    const attendanceId = ((await responseJson(created)).data as { id: string }).id;

    const patched = await patchAttendance(
      jsonRequest("PATCH", {
        attendanceId,
        payload: { status: "ABSENT" },
      }),
    );
    const refreshed = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });

    expect(patched.status).toBe(200);
    expect(refreshed.remainingSessions).toBe(4);
  });

  it("restores sessions when deleting a consuming attendance", async () => {
    await signIn();
    const fx = await dojoFixture();
    const sub = await createActiveSubscription(fx, { remainingSessions: 2 });
    await prisma.payment.create({ data: { memberSubscriptionId: sub.id, amount: sub.amount } });
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z") },
    });
    const session = await createSessionForGroup(fx.adultBjj.id);
    const created = await createAttendance(
      jsonRequest("POST", { sessionId: session.id, memberId: fx.adult.id, status: "PRESENT" }),
    );
    const attendanceId = ((await responseJson(created)).data as { id: string }).id;

    const deleted = await deleteAttendance(jsonRequest("DELETE", { attendanceId }));
    const refreshed = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });

    expect(deleted.status).toBe(200);
    expect(refreshed.remainingSessions).toBe(2);
  });

  it("blocks archived members from check-in", async () => {
    await signIn();
    const fx = await dojoFixture();
    const sub = await createActiveSubscription(fx);
    await prisma.payment.create({ data: { memberSubscriptionId: sub.id, amount: sub.amount } });
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z") },
    });
    const session = await createSessionForGroup(fx.adultBjj.id);
    await prisma.member.update({
      where: { id: fx.adult.id },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });

    const res = await createAttendance(
      jsonRequest("POST", { sessionId: session.id, memberId: fx.adult.id, status: "PRESENT" }),
    );

    expect(res.status).toBe(403);
  });
});

describe("session postpone scenarios", () => {
  it("rejects postpone when attendances already exist on the session", async () => {
    await signIn();
    const fx = await dojoFixture();
    const session = await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-05-18T18:00:00.000Z"),
    });
    const sub = await createActiveSubscription(fx, { remainingSessions: 5 });
    await prisma.payment.create({ data: { memberSubscriptionId: sub.id, amount: sub.amount } });
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z") },
    });
    await createAttendance(
      jsonRequest("POST", { sessionId: session.id, memberId: fx.adult.id, status: "PRESENT" }),
    );

    const res = await routeWithSessionId(postponeSession, session.id, "PATCH", {
      postponedTo: "2026-05-25T16:00:00.000Z",
      reason: "MAUVAIS_METEO",
      details: "Pluie",
    });
    const body = await responseJson(res);

    expect(res.status).toBe(409);
    expect(String(body.error)).toMatch(/pointages/i);
  });

  it("allows postpone after attendances are deleted", async () => {
    await signIn();
    const fx = await dojoFixture();
    const session = await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-05-18T18:00:00.000Z"),
    });
    const sub = await createActiveSubscription(fx, { remainingSessions: 5 });
    await prisma.payment.create({ data: { memberSubscriptionId: sub.id, amount: sub.amount } });
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z") },
    });
    const attendanceRes = await createAttendance(
      jsonRequest("POST", { sessionId: session.id, memberId: fx.adult.id, status: "PRESENT" }),
    );
    const attendanceBody = await responseJson(attendanceRes);
    const attendanceId = (attendanceBody.data as { id: string }).id;

    const blocked = await routeWithSessionId(postponeSession, session.id, "PATCH", {
      postponedTo: "2026-05-25T16:00:00.000Z",
      reason: "MAUVAIS_METEO",
    });
    expect(blocked.status).toBe(409);

    const deleted = await deleteAttendance(jsonRequest("DELETE", { attendanceId }));
    expect(deleted.status).toBe(200);

    const postponed = await routeWithSessionId(postponeSession, session.id, "PATCH", {
      postponedTo: "2026-05-25T16:00:00.000Z",
      reason: "MAUVAIS_METEO",
    });
    expect(postponed.status).toBe(200);
  });

  it("postpones a session when no attendances exist", async () => {
    await signIn();
    const fx = await dojoFixture();
    const session = await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-05-18T18:00:00.000Z"),
    });

    const postponed = await routeWithSessionId(
      postponeSession,
      session.id,
      "PATCH",
      {
        postponedTo: "2026-05-25T16:00:00.000Z",
        reason: "MAUVAIS_METEO",
        details: "Pluie",
      },
    );
    const body = await responseJson(postponed);
    const data = body.data as {
      status: string;
      sessionDate: string;
      postponementDetails: string;
    };
    const details = JSON.parse(data.postponementDetails) as {
      original: { date: string; startTime: string };
    };

    expect(postponed.status).toBe(200);
    expect(data.status).toBe("RESCHEDULED");
    expect(details.original.startTime).toBe("18:00");
  });

  it("preserves the original slot when postponing twice", async () => {
    await signIn();
    const fx = await dojoFixture();
    const session = await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-05-18T18:00:00.000Z"),
    });

    await routeWithSessionId(postponeSession, session.id, "PATCH", {
      postponedTo: "2026-05-25T16:00:00.000Z",
      reason: "COACH_ABSENT",
    });
    const second = await routeWithSessionId(postponeSession, session.id, "PATCH", {
      postponedTo: "2026-06-01T16:00:00.000Z",
      reason: "AUTRE",
      details: "Report supplémentaire",
    });
    const body = await responseJson(second);
    const details = JSON.parse((body.data as { postponementDetails: string }).postponementDetails) as {
      original: { date: string; startTime: string };
    };

    expect(second.status).toBe(200);
    expect(details.original.startTime).toBe("18:00");
    expect(new Date(details.original.date).toISOString()).toBe(
      new Date("2026-05-18T18:00:00.000Z").toISOString(),
    );
  });

  it("rejects postpone when the new slot conflicts with the coach", async () => {
    await signIn();
    const fx = await dojoFixture();
    const session = await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-05-18T18:00:00.000Z"),
    });
    await createSessionForGroup(fx.adultBjjOverlap.id, {
      sessionDate: new Date("2026-05-25T00:00:00.000Z"),
      startTime: "18:00",
      endTime: "19:00",
      room: "Dojo B",
      coachId: fx.coach.id,
    });

    const res = await routeWithSessionId(postponeSession, session.id, "PATCH", {
      postponedTo: "2026-05-25T17:00:00.000Z",
      reason: "MAUVAIS_METEO",
    });
    const body = await responseJson(res);

    expect(res.status).toBe(409);
    expect(String(body.error)).toMatch(/coach/i);
  });

  it("rejects postpone on cancelled sessions", async () => {
    await signIn();
    const fx = await dojoFixture();
    const session = await createSessionForGroup(fx.adultBjj.id);
    await prisma.session.update({
      where: { id: session.id },
      data: { status: "CANCELLED", exceptionReason: "Férié" },
    });

    const res = await routeWithSessionId(postponeSession, session.id, "PATCH", {
      postponedTo: "2026-05-25T16:00:00.000Z",
      reason: "AUTRE",
    });

    expect(res.status).toBe(409);
  });

  it("rejects postpone on completed sessions", async () => {
    await signIn();
    const fx = await dojoFixture();
    const session = await createSessionForGroup(fx.adultBjj.id);
    await prisma.session.update({
      where: { id: session.id },
      data: { status: "COMPLETED" },
    });

    const res = await routeWithSessionId(postponeSession, session.id, "PATCH", {
      postponedTo: "2026-05-25T16:00:00.000Z",
      reason: "AUTRE",
    });

    expect(res.status).toBe(409);
  });

  it("rejects postpone when the new slot conflicts with the room", async () => {
    await signIn();
    const fx = await dojoFixture();
    const otherCoach = await prisma.coach.create({
      data: {
        firstName: "Coach",
        lastName: "Two",
        phone: `coach-two-${Date.now()}`,
        sportId: fx.karate.id,
      },
    });
    const session = await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-05-18T18:00:00.000Z"),
      room: "Dojo A",
    });
    await createSessionForGroup(fx.adultKarate.id, {
      sessionDate: new Date("2026-05-25T00:00:00.000Z"),
      startTime: "18:00",
      endTime: "19:00",
      room: "Dojo A",
      coachId: otherCoach.id,
    });

    const res = await routeWithSessionId(postponeSession, session.id, "PATCH", {
      postponedTo: "2026-05-25T17:00:00.000Z",
      reason: "MAUVAIS_METEO",
    });
    const body = await responseJson(res);

    expect(res.status).toBe(409);
    expect(String(body.error)).toMatch(/salle/i);
  });
});

describe("session edit guard scenarios", () => {
  it("rejects PATCH session when attendances already exist", async () => {
    await signIn();
    const fx = await dojoFixture();
    const session = await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-05-18T18:00:00.000Z"),
    });
    const sub = await createActiveSubscription(fx, { remainingSessions: 5 });
    await prisma.payment.create({ data: { memberSubscriptionId: sub.id, amount: sub.amount } });
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z") },
    });
    await createAttendance(
      jsonRequest("POST", { sessionId: session.id, memberId: fx.adult.id, status: "PRESENT" }),
    );

    const res = await routeWithSessionId(patchSession, session.id, "PATCH", {
      editMode: "exception",
      room: "Dojo B",
    });
    const body = await responseJson(res);

    expect(res.status).toBe(409);
    expect(String(body.error)).toMatch(/pointages/i);
  });

  it("rejects DELETE session when attendances already exist", async () => {
    await signIn();
    const fx = await dojoFixture();
    const session = await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-05-18T18:00:00.000Z"),
    });
    const sub = await createActiveSubscription(fx, { remainingSessions: 5 });
    await prisma.payment.create({ data: { memberSubscriptionId: sub.id, amount: sub.amount } });
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z") },
    });
    await createAttendance(
      jsonRequest("POST", { sessionId: session.id, memberId: fx.adult.id, status: "PRESENT" }),
    );

    const res = await routeWithSessionId(deleteSession, session.id, "DELETE", null);
    const body = await responseJson(res);

    expect(res.status).toBe(409);
    expect(String(body.error)).toMatch(/pointages/i);
  });

  it("cancels DELETE session instead of physically deleting it", async () => {
    await signIn();
    const fx = await dojoFixture();
    const session = await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-05-18T18:00:00.000Z"),
    });

    const res = await routeWithSessionId(deleteSession, session.id, "DELETE", null);
    const body = await responseJson(res);
    const refreshed = await prisma.session.findUniqueOrThrow({ where: { id: session.id } });

    expect(res.status).toBe(200);
    expect((body.data as { status: string }).status).toBe("CANCELLED");
    expect(refreshed.status).toBe("CANCELLED");
  });

  it("allows PATCH session after attendances are deleted", async () => {
    await signIn();
    const fx = await dojoFixture();
    const session = await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-05-18T18:00:00.000Z"),
      room: "Dojo A",
    });
    const sub = await createActiveSubscription(fx, { remainingSessions: 5 });
    await prisma.payment.create({ data: { memberSubscriptionId: sub.id, amount: sub.amount } });
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z") },
    });
    const attendanceRes = await createAttendance(
      jsonRequest("POST", { sessionId: session.id, memberId: fx.adult.id, status: "PRESENT" }),
    );
    const attendanceBody = await responseJson(attendanceRes);
    const attendanceId = (attendanceBody.data as { id: string }).id;

    const blocked = await routeWithSessionId(patchSession, session.id, "PATCH", {
      editMode: "exception",
      room: "Dojo B",
    });
    expect(blocked.status).toBe(409);

    const deleted = await deleteAttendance(jsonRequest("DELETE", { attendanceId }));
    expect(deleted.status).toBe(200);

    const patched = await routeWithSessionId(patchSession, session.id, "PATCH", {
      editMode: "exception",
      room: "Dojo B",
    });
    const body = await responseJson(patched);

    expect(patched.status).toBe(200);
    expect((body.data as { room: string }).room).toBe("Dojo B");
  });
});

describe("session finalization", () => {
  it("blocks incomplete finalization, then finalizes and reopens explicitly", async () => {
    await signIn();
    const fx = await dojoFixture();
    const session = await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-06-11T00:00:00.000Z"),
      startTime: "18:00",
      endTime: "19:30",
    });
    await prisma.groupMember.create({
      data: {
        groupId: fx.adultBjj.id,
        memberId: fx.adult.id,
        startDate: new Date("2026-05-01T00:00:00.000Z"),
      },
    });

    const incomplete = await routeWithSessionId(
      finalizeSession,
      session.id,
      "POST",
      { action: "finalize" },
    );
    expect(incomplete.status).toBe(409);

    await prisma.attendance.create({
      data: {
        sessionId: session.id,
        memberId: fx.adult.id,
        status: "ABSENT",
      },
    });
    const completed = await routeWithSessionId(
      finalizeSession,
      session.id,
      "POST",
      { action: "finalize" },
    );
    expect(completed.status).toBe(200);
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: session.id } })).status,
    ).toBe("COMPLETED");

    const reopened = await routeWithSessionId(
      finalizeSession,
      session.id,
      "POST",
      { action: "reopen" },
    );
    expect(reopened.status).toBe(200);
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: session.id } })).status,
    ).toBe("PLANNED");
  });

  it("allows late check-in with the subscription that was valid on the session date", async () => {
    await signIn();
    const fx = await dojoFixture();
    const session = await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-06-11T00:00:00.000Z"),
    });
    const subscription = await createActiveSubscription(fx, {
      status: "EXPIRED",
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      endDate: new Date("2026-06-12T00:00:00.000Z"),
      remainingSessions: 4,
    });
    await prisma.payment.create({
      data: { memberSubscriptionId: subscription.id, amount: subscription.amount },
    });
    await prisma.groupMember.create({
      data: {
        groupId: fx.adultBjj.id,
        memberId: fx.adult.id,
        startDate: new Date("2026-06-01T00:00:00.000Z"),
      },
    });

    const response = await createAttendance(
      jsonRequest("POST", {
        sessionId: session.id,
        memberId: fx.adult.id,
        status: "PRESENT",
      }),
    );
    const refreshed = await prisma.memberSubscription.findUniqueOrThrow({
      where: { id: subscription.id },
    });

    expect(response.status).toBe(201);
    expect(refreshed.remainingSessions).toBe(3);
  });

  it("requires reopening before changing a finalized attendance", async () => {
    await signIn();
    const fx = await dojoFixture();
    const session = await createSessionForGroup(fx.adultBjj.id, {
      sessionDate: new Date("2026-06-11T00:00:00.000Z"),
    });
    const attendance = await prisma.attendance.create({
      data: {
        sessionId: session.id,
        memberId: fx.adult.id,
        status: "ABSENT",
      },
    });
    await prisma.session.update({
      where: { id: session.id },
      data: { status: "COMPLETED" },
    });

    const response = await patchAttendance(
      jsonRequest("PATCH", {
        attendanceId: attendance.id,
        payload: { status: "PRESENT" },
      }),
    );

    expect(response.status).toBe(409);
    expect((await responseJson(response)).code).toBe("SESSION_REOPEN_REQUIRED");
  });
});

describe("payment corrections and member archive", () => {
  it("updates and deletes payments while keeping debt consistent", async () => {
    await signIn();
    const fx = await dojoFixture();
    const sub = await createActiveSubscription(fx, { amount: 10000 });
    const payment = await prisma.payment.create({
      data: { memberSubscriptionId: sub.id, amount: 4000 },
    });

    const patched = await patchPayment(
      jsonRequest("PATCH", {
        paymentId: payment.id,
        payload: { amount: 3000, correctionReason: "Erreur de saisie" },
      }),
    );
    expect(patched.status).toBe(200);
    const originalAfterPatch = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(originalAfterPatch.amount).toBe(4000);

    const afterPatch = await prisma.payment.aggregate({
      where: { memberSubscriptionId: sub.id },
      _sum: { amount: true },
    });
    expect(afterPatch._sum.amount).toBe(3000);

    const deleted = await deletePayment(
      jsonRequest("DELETE", { paymentId: payment.id, correctionReason: "Paiement saisi en double" }),
    );
    expect(deleted.status).toBe(200);

    const afterDelete = await prisma.payment.aggregate({
      where: { memberSubscriptionId: sub.id },
      _sum: { amount: true },
    });
    expect(afterDelete._sum.amount ?? 0).toBe(0);
    expect(await prisma.payment.count({ where: { memberSubscriptionId: sub.id } })).toBe(3);
  });

  it("archives a member, cancels subscriptions and ends active group assignments", async () => {
    await signIn();
    const fx = await dojoFixture();
    const sub = await createActiveSubscription(fx);
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z"), status: "ACTIVE" },
    });

    const res = await archiveMember(jsonRequest("DELETE", { memberId: fx.adult.id }));
    const member = await prisma.member.findUniqueOrThrow({ where: { id: fx.adult.id } });
    const refreshedSub = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    const assignment = await prisma.groupMember.findFirst({
      where: { memberId: fx.adult.id, groupId: fx.adultBjj.id },
    });

    expect(res.status).toBe(200);
    expect(member.status).toBe("ARCHIVED");
    expect(refreshedSub.status).toBe("CANCELLED");
    expect(assignment?.status).toBe("INACTIVE");
    expect(assignment?.endDate).not.toBeNull();
  });

  it("rejects disabled and demoted users from fresh database auth state", async () => {
    const disabled = await prisma.user.create({
      data: {
        tenantId: TEST_TENANT_ID,
        name: "Disabled Admin",
        email: "disabled-admin@test.local",
        role: "ADMIN",
        isActive: false,
        passwordHash: await hashPassword("password123"),
      },
    });
    authState.token = await signAuthToken({
      userId: disabled.id,
      tenantId: TEST_TENANT_ID,
      tenantSlug: TEST_TENANT_SLUG,
      email: disabled.email,
      name: disabled.name,
      role: "ADMIN",
    });

    const disabledMe = await getAuthMe();
    expect((await responseJson(disabledMe)).data).toBeNull();
    const disabledApi = await createPayment(jsonRequest("POST", { memberSubscriptionId: "missing", amount: 100 }));
    expect(disabledApi.status).toBe(401);

    const demoted = await prisma.user.create({
      data: {
        tenantId: TEST_TENANT_ID,
        name: "Demoted Admin",
        email: "demoted-admin@test.local",
        role: "STAFF",
        isActive: true,
        passwordHash: await hashPassword("password123"),
        permissions: { create: [{ tenantId: TEST_TENANT_ID, key: "payments.manage" }] },
      },
    });
    authState.token = await signAuthToken({
      userId: demoted.id,
      tenantId: TEST_TENANT_ID,
      tenantSlug: TEST_TENANT_SLUG,
      email: demoted.email,
      name: demoted.name,
      role: "ADMIN",
    });

    const demotedAdminRoute = await patchClubSettings(jsonRequest("PATCH", { maxStaffDiscountPercent: 10 }));
    expect(demotedAdminRoute.status).toBe(403);
  });

  it("deactivates groups without deleting sessions or attendance", async () => {
    await signIn();
    const fx = await dojoFixture();
    const sub = await createActiveSubscription(fx);
    await prisma.payment.create({ data: { memberSubscriptionId: sub.id, amount: sub.amount } });
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z") },
    });
    const session = await createSessionForGroup(fx.adultBjj.id);
    const attendance = await createAttendance(
      jsonRequest("POST", { sessionId: session.id, memberId: fx.adult.id, status: "PRESENT" }),
    );
    expect(attendance.status).toBe(201);

    const response = await deactivateGroup(jsonRequest("DELETE", { groupId: fx.adultBjj.id }));
    const group = await prisma.group.findUniqueOrThrow({ where: { id: fx.adultBjj.id } });

    expect(response.status).toBe(200);
    expect(group.isActive).toBe(false);
    expect(await prisma.session.count({ where: { groupId: fx.adultBjj.id } })).toBe(1);
    expect(await prisma.attendance.count({ where: { sessionId: session.id } })).toBe(1);
  });

  it("archives member detail deletes instead of hard-deleting the member", async () => {
    await signIn();
    const fx = await dojoFixture();
    const sub = await createActiveSubscription(fx);
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z"), status: "ACTIVE" },
    });

    const response = await routeWithSessionId(deleteMemberDetail, fx.adult.id, "DELETE", {});
    const member = await prisma.member.findUnique({ where: { id: fx.adult.id } });
    const subscription = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });

    expect(response.status).toBe(200);
    expect(member?.status).toBe("ARCHIVED");
    expect(subscription.status).toBe("CANCELLED");
    expect(await prisma.member.count({ where: { id: fx.adult.id } })).toBe(1);
  });

  it("cancels subscription deletes and closes group-member deletes", async () => {
    await signIn();
    const fx = await dojoFixture();
    const sub = await createActiveSubscription(fx);
    const assignment = await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z"), status: "ACTIVE" },
    });

    const subscriptionResponse = await deleteMemberSubscription(jsonRequest("DELETE", { subscriptionId: sub.id }));
    const assignmentResponse = await closeGroupMember(jsonRequest("DELETE", { groupMemberId: assignment.id }));
    const refreshedSub = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    const refreshedAssignment = await prisma.groupMember.findUniqueOrThrow({ where: { id: assignment.id } });

    expect(subscriptionResponse.status).toBe(200);
    expect(assignmentResponse.status).toBe(200);
    expect(refreshedSub.status).toBe("CANCELLED");
    expect(refreshedAssignment.status).toBe("INACTIVE");
    expect(refreshedAssignment.endDate).not.toBeNull();
  });

  it("bulk group-member delete closes assignments instead of deleting them", async () => {
    await signIn();
    const fx = await dojoFixture();
    await prisma.groupMember.create({
      data: { groupId: fx.adultBjj.id, memberId: fx.adult.id, startDate: new Date("2026-05-01T00:00:00.000Z"), status: "ACTIVE" },
    });

    const response = await bulkCloseGroupMembers(
      jsonRequest("DELETE", { groupId: fx.adultBjj.id, memberIds: [fx.adult.id] }),
    );
    const body = await responseJson(response);
    const assignment = await prisma.groupMember.findUniqueOrThrow({
      where: { tenantId_groupId_memberId: { tenantId: TEST_TENANT_ID, groupId: fx.adultBjj.id, memberId: fx.adult.id } },
    });

    expect(response.status).toBe(200);
    expect((body.data as { closedCount: number }).closedCount).toBe(1);
    expect(assignment.status).toBe("INACTIVE");
    expect(assignment.endDate).not.toBeNull();
  });

  it("records payment corrections and reversals as audit-backed ledger rows", async () => {
    await signIn();
    const fx = await dojoFixture();
    const sub = await createActiveSubscription(fx, { amount: 10000 });
    const created = await createPayment(
      jsonRequest("POST", { memberSubscriptionId: sub.id, amount: 7000 }),
    );
    const createdBody = await responseJson(created);
    const paymentId = (createdBody.data as { id: string }).id;

    const correction = await patchPayment(
      jsonRequest("PATCH", {
        paymentId,
        payload: { amount: 6000, correctionReason: "Montant corrige apres controle caisse" },
      }),
    );
    const reversal = await deletePayment(
      jsonRequest("DELETE", { paymentId, correctionReason: "Annulation demandee par admin" }),
    );
    const rows = await prisma.payment.findMany({ where: { memberSubscriptionId: sub.id }, orderBy: { createdAt: "asc" } });
    const audits = await prisma.auditLog.findMany({
      where: { action: { in: ["PAYMENT_CORRECTED", "PAYMENT_REVERSED"] } },
      orderBy: { createdAt: "asc" },
    });

    expect(correction.status).toBe(200);
    expect(reversal.status).toBe(200);
    expect(rows.map((row) => row.entryType)).toEqual(["PAYMENT", "CORRECTION", "REVERSAL"]);
    expect(rows.map((row) => row.amount)).toEqual([7000, -1000, -6000]);
    expect(audits).toHaveLength(2);
    expect(audits.every((audit) => audit.userId === "admin-test-user")).toBe(true);
    expect(audits.every((audit) => audit.details?.includes("reason"))).toBe(true);
  });

  it("rejects attendance PATCH loopholes with the same rules as creation", async () => {
    await signIn();
    const fx = await dojoFixture();
    let index = 0;

    async function makePatchCase(options: {
      memberStatus?: "ACTIVE" | "ARCHIVED";
      sessionStatus?: "PLANNED" | "CANCELLED";
      assignmentStartDate?: Date;
      paid?: boolean;
      initialStatus?: "OVERRIDE" | "PRESENT";
    } = {}) {
      index += 1;
      const member = await prisma.member.create({
        data: {
          firstName: `Case${index}`,
          lastName: "Hardening",
          phone: `hardening-${index}`,
          memberType: "ADULT",
          status: options.memberStatus ?? "ACTIVE",
        },
      });
      const session = await createSessionForGroup(fx.adultBjjOverlap.id, {
        sessionDate: new Date("2026-05-18T00:00:00.000Z"),
        startTime: `${String(8 + index).padStart(2, "0")}:00`,
        endTime: `${String(9 + index).padStart(2, "0")}:00`,
      });
      if (options.sessionStatus) {
        await prisma.session.update({ where: { id: session.id }, data: { status: options.sessionStatus } });
      }
      const sub = await createActiveSubscription(fx, {
        memberId: member.id,
        remainingSessions: 5,
        startDate: new Date("2026-05-01T00:00:00.000Z"),
        endDate: new Date("2026-06-01T00:00:00.000Z"),
      });
      if (options.paid !== false) {
        await prisma.payment.create({ data: { memberSubscriptionId: sub.id, amount: sub.amount } });
      }
      await prisma.groupMember.create({
        data: {
          groupId: fx.adultBjjOverlap.id,
          memberId: member.id,
          startDate: options.assignmentStartDate ?? new Date("2026-05-01T00:00:00.000Z"),
          status: "ACTIVE",
        },
      });
      const attendance = await prisma.attendance.create({
        data: {
          sessionId: session.id,
          memberId: member.id,
          memberSubscriptionId: options.initialStatus === "PRESENT" ? sub.id : null,
          status: options.initialStatus ?? "OVERRIDE",
          overrideReason: options.initialStatus === "PRESENT" ? null : "Initial override",
        },
      });
      return attendance;
    }

    const cancelled = await makePatchCase({ sessionStatus: "CANCELLED" });
    expect((await patchAttendance(jsonRequest("PATCH", { attendanceId: cancelled.id, payload: { status: "PRESENT" } }))).status).toBe(409);

    const archived = await makePatchCase({ memberStatus: "ARCHIVED" });
    expect((await patchAttendance(jsonRequest("PATCH", { attendanceId: archived.id, payload: { status: "PRESENT" } }))).status).toBe(403);

    const futureAssignment = await makePatchCase({ assignmentStartDate: new Date("2026-05-19T00:00:00.000Z") });
    const futureResponse = await patchAttendance(jsonRequest("PATCH", { attendanceId: futureAssignment.id, payload: { status: "PRESENT" } }));
    expect(futureResponse.status).toBe(403);
    expect((await responseJson(futureResponse)).code).toBe("NOT_ASSIGNED_TO_GROUP");

    const unpaid = await makePatchCase({ paid: false });
    const unpaidResponse = await patchAttendance(jsonRequest("PATCH", { attendanceId: unpaid.id, payload: { status: "PRESENT" } }));
    expect(unpaidResponse.status).toBe(403);
    expect((await responseJson(unpaidResponse)).code).toBe("SUBSCRIPTION_UNPAID");

    const noReason = await makePatchCase({ initialStatus: "PRESENT" });
    expect((await patchAttendance(jsonRequest("PATCH", { attendanceId: noReason.id, payload: { status: "OVERRIDE" } }))).status).toBe(400);
  });

  it("bulk assignment chooses the active subscription for the group sport", async () => {
    await signIn();
    const fx = await dojoFixture();
    const karateSub = await createActiveSubscription(fx, {
      memberId: fx.adult.id,
      planId: fx.karatePlan.id,
      sportId: fx.karate.id,
      amount: fx.karatePlan.price,
      endDate: new Date(Date.now() + 10 * 86400000),
    });
    await prisma.payment.create({ data: { memberSubscriptionId: karateSub.id, amount: karateSub.amount } });
    const bjjSub = await createActiveSubscription(fx, {
      memberId: fx.adult.id,
      planId: fx.bjjPlan.id,
      sportId: fx.bjj.id,
      amount: fx.bjjPlan.price,
      endDate: new Date(Date.now() + 20 * 86400000),
    });
    await prisma.payment.create({ data: { memberSubscriptionId: bjjSub.id, amount: bjjSub.amount } });

    const response = await bulkCreateGroupMembers(
      jsonRequest("POST", {
        groupId: fx.adultBjj.id,
        memberIds: [fx.adult.id],
        startDate: new Date("2026-05-01T00:00:00.000Z").toISOString(),
      }),
    );
    const body = await responseJson(response);

    expect(response.status).toBe(200);
    expect((body.data as { createdCount: number; skippedSportMismatchCount: number }).createdCount).toBe(1);
    expect((body.data as { createdCount: number; skippedSportMismatchCount: number }).skippedSportMismatchCount).toBe(0);
  });

  it("rejects subscription amounts below the paid ledger total", async () => {
    await signIn();
    const fx = await dojoFixture();
    const sub = await createActiveSubscription(fx, { amount: 10000 });
    await prisma.payment.create({ data: { memberSubscriptionId: sub.id, amount: 5000 } });

    const response = await patchMemberSubscription(
      jsonRequest("PATCH", {
        subscriptionId: sub.id,
        payload: { amount: 4000, adjustmentReason: "Controle solde" },
      }),
    );

    expect(response.status).toBe(409);
  });
});

describe("contextual weekly consumption (plan below group standard)", () => {
  const completeWeekScenarios = [
    ["PRESENT-PRESENT-PRESENT", ["PRESENT", "PRESENT", "PRESENT"], [201, 201, 403]],
    ["PRESENT-PRESENT-ABSENT", ["PRESENT", "PRESENT", "ABSENT"], [201, 201, 201]],
    ["PRESENT-ABSENT-PRESENT", ["PRESENT", "ABSENT", "PRESENT"], [201, 201, 201]],
    ["PRESENT-ABSENT-ABSENT", ["PRESENT", "ABSENT", "ABSENT"], [201, 201, 201]],
    ["ABSENT-PRESENT-PRESENT", ["ABSENT", "PRESENT", "PRESENT"], [201, 201, 201]],
    ["ABSENT-PRESENT-ABSENT", ["ABSENT", "PRESENT", "ABSENT"], [201, 201, 201]],
    ["ABSENT-ABSENT-PRESENT", ["ABSENT", "ABSENT", "PRESENT"], [201, 201, 201]],
    ["ABSENT-ABSENT-ABSENT", ["ABSENT", "ABSENT", "ABSENT"], [201, 201, 201]],
  ] as const;

  it.each(completeWeekScenarios)(
    "keeps the 2/3 weekly balance correct for %s",
    async (_label, statuses, expectedHttpStatuses) => {
      await signIn();
      const fx = await dojoFixture();
      const { plan, sessions } = await setupTwoPerWeekPlanWithThreeSessions(fx);
      const sub = await enrollMemberForContextualPlan(fx, plan.id);

      for (let index = 0; index < sessions.length; index++) {
        const response = await createAttendance(
          jsonRequest("POST", {
            sessionId: sessions[index].id,
            memberId: fx.adult.id,
            status: statuses[index],
          }),
        );
        expect(response.status).toBe(expectedHttpStatuses[index]);
      }

      const refreshed = await prisma.memberSubscription.findUniqueOrThrow({
        where: { id: sub.id },
      });
      expect(refreshed.remainingSessions).toBe(6);
    },
  );

  it("rejects subscription plans above the sport weekly standard", async () => {
    await signIn();
    const fx = await dojoFixture();
    await setupTwoPerWeekPlanWithThreeSessions(fx);

    const res = await createSubscriptionPlan(
      jsonRequest("POST", {
        name: "BJJ 4/sem",
        price: 6000,
        sessionsPerWeek: 4,
        validityDays: 30,
        sportId: fx.bjj.id,
      }),
    );
    const body = await responseJson(res);

    expect(res.status).toBe(409);
    expect(body.code).toBe("PLAN_EXCEEDS_SPORT_STANDARD");
  });

  it("scenario 1: present, absent, present", async () => {
    await signIn();
    const fx = await dojoFixture();
    const { plan, sessions } = await setupTwoPerWeekPlanWithThreeSessions(fx);
    const sub = await enrollMemberForContextualPlan(fx, plan.id);

    expect(await weeklyAllowanceLeft(sub.id, fx.adult.id, sessions[0], fx.adultBjj.id, 2)).toBe(2);

    await createAttendance(
      jsonRequest("POST", { sessionId: sessions[0].id, memberId: fx.adult.id, status: "PRESENT" }),
    );
    expect(await weeklyAllowanceLeft(sub.id, fx.adult.id, sessions[1], fx.adultBjj.id, 2)).toBe(1);

    await createAttendance(
      jsonRequest("POST", { sessionId: sessions[1].id, memberId: fx.adult.id, status: "ABSENT" }),
    );
    expect(await weeklyAllowanceLeft(sub.id, fx.adult.id, sessions[2], fx.adultBjj.id, 2)).toBe(1);

    await createAttendance(
      jsonRequest("POST", { sessionId: sessions[2].id, memberId: fx.adult.id, status: "PRESENT" }),
    );
    expect(
      await weeklyAllowanceAfterWeek(sub.id, fx.adult.id, sessions[2].sessionDate, fx.adultBjj.id, 2),
    ).toBe(0);

    const refreshed = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(refreshed.remainingSessions).toBe(6);
  });

  it("scenario 2: present, absent, absent", async () => {
    await signIn();
    const fx = await dojoFixture();
    const { plan, sessions } = await setupTwoPerWeekPlanWithThreeSessions(fx);
    const sub = await enrollMemberForContextualPlan(fx, plan.id);

    await createAttendance(
      jsonRequest("POST", { sessionId: sessions[0].id, memberId: fx.adult.id, status: "PRESENT" }),
    );
    await createAttendance(
      jsonRequest("POST", { sessionId: sessions[1].id, memberId: fx.adult.id, status: "ABSENT" }),
    );
    await createAttendance(
      jsonRequest("POST", { sessionId: sessions[2].id, memberId: fx.adult.id, status: "ABSENT" }),
    );

    expect(
      await weeklyAllowanceAfterWeek(sub.id, fx.adult.id, sessions[2].sessionDate, fx.adultBjj.id, 2),
    ).toBe(0);
    const refreshed = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(refreshed.remainingSessions).toBe(6);
  });

  it("scenario 3: absent, present, present", async () => {
    await signIn();
    const fx = await dojoFixture();
    const { plan, sessions } = await setupTwoPerWeekPlanWithThreeSessions(fx);
    const sub = await enrollMemberForContextualPlan(fx, plan.id);

    await createAttendance(
      jsonRequest("POST", { sessionId: sessions[0].id, memberId: fx.adult.id, status: "ABSENT" }),
    );
    expect(await weeklyAllowanceLeft(sub.id, fx.adult.id, sessions[1], fx.adultBjj.id, 2)).toBe(2);

    await createAttendance(
      jsonRequest("POST", { sessionId: sessions[1].id, memberId: fx.adult.id, status: "PRESENT" }),
    );
    await createAttendance(
      jsonRequest("POST", { sessionId: sessions[2].id, memberId: fx.adult.id, status: "PRESENT" }),
    );

    expect(
      await weeklyAllowanceAfterWeek(sub.id, fx.adult.id, sessions[2].sessionDate, fx.adultBjj.id, 2),
    ).toBe(0);
    const refreshed = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(refreshed.remainingSessions).toBe(6);
  });

  it("does not consume the first absence when a later configured session is not generated yet", async () => {
    await signIn();
    const fx = await dojoFixture();
    const { plan, sessions } = await setupTwoPerWeekPlanWithThreeSessions(fx);
    const sub = await enrollMemberForContextualPlan(fx, plan.id);
    await prisma.session.delete({ where: { id: sessions[2].id } });

    const response = await createAttendance(
      jsonRequest("POST", {
        sessionId: sessions[0].id,
        memberId: fx.adult.id,
        status: "ABSENT",
      }),
    );
    const refreshed = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });

    expect(response.status).toBe(201);
    expect(refreshed.remainingSessions).toBe(8);
  });

  it("consumes the first absence when the third configured session is actually cancelled", async () => {
    await signIn();
    const fx = await dojoFixture();
    const { plan, sessions } = await setupTwoPerWeekPlanWithThreeSessions(fx);
    const sub = await enrollMemberForContextualPlan(fx, plan.id);
    await prisma.session.update({
      where: { id: sessions[2].id },
      data: { status: "CANCELLED" },
    });

    const response = await createAttendance(
      jsonRequest("POST", {
        sessionId: sessions[0].id,
        memberId: fx.adult.id,
        status: "ABSENT",
      }),
    );
    const refreshed = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });

    expect(response.status).toBe(201);
    expect(refreshed.remainingSessions).toBe(7);
  });

  it("scenario 4: absent, absent, present", async () => {
    await signIn();
    const fx = await dojoFixture();
    const { plan, sessions } = await setupTwoPerWeekPlanWithThreeSessions(fx);
    const sub = await enrollMemberForContextualPlan(fx, plan.id);

    await createAttendance(
      jsonRequest("POST", { sessionId: sessions[0].id, memberId: fx.adult.id, status: "ABSENT" }),
    );
    expect(await weeklyAllowanceLeft(sub.id, fx.adult.id, sessions[1], fx.adultBjj.id, 2)).toBe(2);

    await createAttendance(
      jsonRequest("POST", { sessionId: sessions[1].id, memberId: fx.adult.id, status: "ABSENT" }),
    );
    expect(await weeklyAllowanceLeft(sub.id, fx.adult.id, sessions[2], fx.adultBjj.id, 2)).toBe(1);

    await createAttendance(
      jsonRequest("POST", { sessionId: sessions[2].id, memberId: fx.adult.id, status: "PRESENT" }),
    );

    expect(
      await weeklyAllowanceAfterWeek(sub.id, fx.adult.id, sessions[2].sessionDate, fx.adultBjj.id, 2),
    ).toBe(0);
    const refreshed = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(refreshed.remainingSessions).toBe(6);
  }, 10000);

  it("scenario 5: absent, absent, absent", async () => {
    await signIn();
    const fx = await dojoFixture();
    const { plan, sessions } = await setupTwoPerWeekPlanWithThreeSessions(fx);
    const sub = await enrollMemberForContextualPlan(fx, plan.id);

    await createAttendance(
      jsonRequest("POST", { sessionId: sessions[0].id, memberId: fx.adult.id, status: "ABSENT" }),
    );
    await createAttendance(
      jsonRequest("POST", { sessionId: sessions[1].id, memberId: fx.adult.id, status: "ABSENT" }),
    );
    await createAttendance(
      jsonRequest("POST", { sessionId: sessions[2].id, memberId: fx.adult.id, status: "ABSENT" }),
    );

    expect(
      await weeklyAllowanceAfterWeek(sub.id, fx.adult.id, sessions[2].sessionDate, fx.adultBjj.id, 2),
    ).toBe(0);
    const refreshed = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(refreshed.remainingSessions).toBe(6);
  });

  it("blocks a third present when two weekly consumptions are already used", async () => {
    await signIn();
    const fx = await dojoFixture();
    const { plan, sessions } = await setupTwoPerWeekPlanWithThreeSessions(fx);
    await enrollMemberForContextualPlan(fx, plan.id);

    await createAttendance(
      jsonRequest("POST", { sessionId: sessions[0].id, memberId: fx.adult.id, status: "PRESENT" }),
    );
    await createAttendance(
      jsonRequest("POST", { sessionId: sessions[1].id, memberId: fx.adult.id, status: "PRESENT" }),
    );

    const blocked = await createAttendance(
      jsonRequest("POST", { sessionId: sessions[2].id, memberId: fx.adult.id, status: "PRESENT" }),
    );
    const body = await responseJson(blocked);

    expect(blocked.status).toBe(403);
    expect(body.code).toBe("SUBSCRIPTION_WEEK_LIMIT_REACHED");
  });

  it("respects disabled absence consumption in contextual mode", async () => {
    await signIn();
    const fx = await dojoFixture();
    const { plan, sessions } = await setupTwoPerWeekPlanWithThreeSessions(fx);
    const sub = await enrollMemberForContextualPlan(fx, plan.id);
    await prisma.clubSettings.update({
      where: { id: "default" },
      data: { absentConsumesSession: false },
    });

    for (const session of sessions) {
      const response = await createAttendance(
        jsonRequest("POST", {
          sessionId: session.id,
          memberId: fx.adult.id,
          status: "ABSENT",
        }),
      );
      expect(response.status).toBe(201);
    }

    const refreshed = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });
    expect(refreshed.remainingSessions).toBe(8);
  });

  it("blocks an out-of-order third present without over-consuming the subscription", async () => {
    await signIn();
    const fx = await dojoFixture();
    const { plan, sessions } = await setupTwoPerWeekPlanWithThreeSessions(fx);
    const sub = await enrollMemberForContextualPlan(fx, plan.id);

    for (const session of [sessions[2], sessions[1]]) {
      const response = await createAttendance(
        jsonRequest("POST", {
          sessionId: session.id,
          memberId: fx.adult.id,
          status: "PRESENT",
        }),
      );
      expect(response.status).toBe(201);
    }

    const blocked = await createAttendance(
      jsonRequest("POST", {
        sessionId: sessions[0].id,
        memberId: fx.adult.id,
        status: "PRESENT",
      }),
    );
    const body = await responseJson(blocked);
    const refreshed = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });

    expect(blocked.status).toBe(403);
    expect(body.code).toBe("SUBSCRIPTION_WEEK_LIMIT_REACHED");
    expect(refreshed.remainingSessions).toBe(6);
  });

  it("blocks correcting an earlier absence to a third present", async () => {
    await signIn();
    const fx = await dojoFixture();
    const { plan, sessions } = await setupTwoPerWeekPlanWithThreeSessions(fx);
    const sub = await enrollMemberForContextualPlan(fx, plan.id);

    const absentResponse = await createAttendance(
      jsonRequest("POST", {
        sessionId: sessions[0].id,
        memberId: fx.adult.id,
        status: "ABSENT",
      }),
    );
    const attendanceId = ((await responseJson(absentResponse)).data as { id: string }).id;

    for (const session of [sessions[2], sessions[1]]) {
      const response = await createAttendance(
        jsonRequest("POST", {
          sessionId: session.id,
          memberId: fx.adult.id,
          status: "PRESENT",
        }),
      );
      expect(response.status).toBe(201);
    }

    const blocked = await patchAttendance(
      jsonRequest("PATCH", {
        attendanceId,
        payload: { status: "PRESENT" },
      }),
    );
    const body = await responseJson(blocked);
    const refreshed = await prisma.memberSubscription.findUniqueOrThrow({ where: { id: sub.id } });

    expect(blocked.status).toBe(403);
    expect(body.code).toBe("SUBSCRIPTION_WEEK_LIMIT_REACHED");
    expect(refreshed.remainingSessions).toBe(6);
  });

  it("matches the pure consumption algorithm for scenario 2", () => {
    const sessions = [
      { id: "s1", sessionDate: new Date("2026-05-18T00:00:00.000Z"), startTime: "18:00" },
      { id: "s2", sessionDate: new Date("2026-05-20T00:00:00.000Z"), startTime: "18:00" },
      { id: "s3", sessionDate: new Date("2026-05-22T00:00:00.000Z"), startTime: "18:00" },
    ];
    const attendances = new Map([
      ["s1", "PRESENT"],
      ["s2", "ABSENT"],
    ] as const);

    const remainingBeforeThird = simulateWeeklyAllowanceRemaining({
      planAllowance: 2,
      mode: "CONTEXTUAL",
      sessionsInWeek: sessions,
      attendancesBySessionId: attendances,
      absentConsumesSession: true,
      beforeSessionId: "s3",
    });
    const thirdUnits = consumptionUnitsForSessionSlot({
      status: "ABSENT",
      mode: "CONTEXTUAL",
      planAllowance: 2,
      sessionsInWeek: sessions,
      attendancesBySessionId: attendances,
      absentConsumesSession: true,
      sessionId: "s3",
    });

    expect(remainingBeforeThird).toBe(1);
    expect(thirdUnits).toBe(1);
  });
});

describe("group room rules", () => {
  it("creates a group without a default room", async () => {
    await signIn();
    const fx = await dojoFixture();

    const res = await createGroup(
      jsonRequest("POST", {
        name: "No Room Group",
        groupType: "ADULTS",
        sportId: fx.bjj.id,
        coachId: fx.coach.id,
        capacity: 8,
      }),
    );
    const body = await responseJson(res);

    expect(res.status).toBe(201);
    expect((body.data as { room: string | null }).room).toBeNull();
  });
});

describe("coach sport qualification policy", () => {
  it("blocks staff from assigning a coach outside qualified sports", async () => {
    await signIn("STAFF");
    const fx = await dojoFixture();

    const response = await createGroup(
      jsonRequest("POST", {
        name: "Karate Staff Blocked",
        groupType: "ADULTS",
        sportId: fx.karate.id,
        coachId: fx.coach.id,
        capacity: 8,
      }),
    );
    const body = await responseJson(response);

    expect(response.status).toBe(403);
    expect(body.code).toBe("COACH_NOT_QUALIFIED");
  });

  it("requires an admin reason before overriding coach sport qualifications", async () => {
    await signIn();
    const fx = await dojoFixture();

    const blocked = await createGroup(
      jsonRequest("POST", {
        name: "Karate Needs Reason",
        groupType: "ADULTS",
        sportId: fx.karate.id,
        coachId: fx.coach.id,
        capacity: 8,
      }),
    );
    expect(blocked.status).toBe(409);

    const allowed = await createGroup(
      jsonRequest("POST", {
        name: "Karate Override",
        groupType: "ADULTS",
        sportId: fx.karate.id,
        coachId: fx.coach.id,
        capacity: 8,
        coachSportOverrideReason: "Temporary certified replacement",
      }),
    );
    const body = await responseJson(allowed);

    expect(allowed.status).toBe(201);
    const groupId = (body.data as { id: string }).id;
    const audit = await prisma.auditLog.findFirst({
      where: { action: "COACH_SPORT_OVERRIDE_USED", entityType: "Group", entityId: groupId },
    });
    expect(audit?.userId).toBe("admin-test-user");
    expect(audit?.details).toContain("Temporary certified replacement");
  });

  it("allows qualified multi-sport coaches without override", async () => {
    await signIn("STAFF");
    const fx = await dojoFixture();
    await prisma.coachSportQualification.create({
      data: { coachId: fx.coach.id, sportId: fx.karate.id },
    });

    const response = await createGroup(
      jsonRequest("POST", {
        name: "Karate Qualified",
        groupType: "ADULTS",
        sportId: fx.karate.id,
        coachId: fx.coach.id,
        capacity: 8,
      }),
    );

    expect(response.status).toBe(201);
    expect(await prisma.auditLog.count({ where: { action: "COACH_SPORT_OVERRIDE_USED" } })).toBe(0);
  });

  it("checks the final coach and sport pair when editing a group", async () => {
    await signIn();
    const fx = await dojoFixture();
    const karateCoach = await prisma.coach.create({
      data: {
        firstName: "Karate",
        lastName: "Coach",
        phone: `karate-coach-${Date.now()}`,
        sportId: fx.karate.id,
      },
    });

    const blocked = await patchGroup(
      jsonRequest("PATCH", {
        groupId: fx.adultBjj.id,
        payload: { coachId: karateCoach.id },
      }),
    );
    expect(blocked.status).toBe(409);

    const allowed = await patchGroup(
      jsonRequest("PATCH", {
        groupId: fx.adultBjj.id,
        payload: {
          coachId: karateCoach.id,
          coachSportOverrideReason: "Cross-training clinic",
        },
      }),
    );

    expect(allowed.status).toBe(200);
    expect(
      await prisma.auditLog.findFirst({
        where: { action: "COACH_SPORT_OVERRIDE_USED", entityType: "Group", entityId: fx.adultBjj.id },
      }),
    ).not.toBeNull();
  });

  it("applies the same qualification rule to manual session coach edits", async () => {
    await signIn("STAFF");
    const fx = await dojoFixture();
    const session = await createSessionForGroup(fx.adultBjj.id);
    const karateCoach = await prisma.coach.create({
      data: {
        firstName: "Session",
        lastName: "Karate",
        phone: `session-karate-${Date.now()}`,
        sportId: fx.karate.id,
      },
    });

    const blocked = await routeWithSessionId(
      patchSession,
      session.id,
      "PATCH",
      { editMode: "exception", coachId: karateCoach.id },
    );
    expect(blocked.status).toBe(403);

    await signIn();
    const allowed = await routeWithSessionId(
      patchSession,
      session.id,
      "PATCH",
      {
        editMode: "exception",
        coachId: karateCoach.id,
        coachSportOverrideReason: "Guest seminar",
      },
    );

    expect(allowed.status).toBe(200);
    expect(
      await prisma.auditLog.findFirst({
        where: { action: "COACH_SPORT_OVERRIDE_USED", entityType: "Session", entityId: session.id },
      }),
    ).not.toBeNull();
  });
});

describe("enrollment revert", () => {
  it("reverts a fresh enrollment with payment and group assignment", async () => {
    await signIn();
    const fx = await dojoFixture();

    const applyResponse = await applyEnrollment(
      jsonRequest("POST", {
        lines: [
          {
            memberId: fx.adult.id,
            groupId: fx.adultBjj.id,
            planId: fx.bjjPlan.id,
            paymentCents: 5000,
          },
        ],
      }),
    );
    const applyBody = await responseJson(applyResponse);

    expect(applyResponse.status).toBe(201);
    const undoSnapshot = (applyBody.data as { undoSnapshot: Record<string, unknown> }).undoSnapshot;
    expect(undoSnapshot.createdPaymentIds).toHaveLength(1);
    expect(undoSnapshot.createdSubscriptionIds).toHaveLength(1);
    expect(undoSnapshot.createdGroupMemberIds).toHaveLength(1);

    const revertResponse = await revertEnrollment(jsonRequest("POST", { undoSnapshot }));
    expect(revertResponse.status).toBe(200);

    const activeSubs = await prisma.memberSubscription.findMany({
      where: { memberId: fx.adult.id, status: "ACTIVE" },
    });
    expect(activeSubs).toHaveLength(0);

    const groupMember = await prisma.groupMember.findUnique({
      where: { tenantId_groupId_memberId: { tenantId: TEST_TENANT_ID, groupId: fx.adultBjj.id, memberId: fx.adult.id } },
    });
    expect(groupMember).toBeNull();
  });

  it("reverts a discounted renewal and restores the previous subscription", async () => {
    await signIn();
    const fx = await dojoFixture();
    const previousSub = await createActiveSubscription(fx, { memberId: fx.adult.id, amount: 3500 });
    const offer = await prisma.offer.create({
      data: {
        name: "10% off",
        kind: "PERCENT_OFF",
        rules: JSON.stringify({ percentOff: 10 }),
      },
    });

    const applyResponse = await applyEnrollment(
      jsonRequest("POST", {
        offerId: offer.id,
        lines: [
          {
            memberId: fx.adult.id,
            groupId: fx.adultBjj.id,
            planId: fx.bjjPlan.id,
            paymentCents: 1000,
          },
        ],
      }),
    );
    const applyBody = await responseJson(applyResponse);

    expect(applyResponse.status).toBe(201);
    const undoSnapshot = (applyBody.data as { undoSnapshot: Record<string, unknown> }).undoSnapshot;
    expect(undoSnapshot.createdSubscriptionIds).toHaveLength(1);
    expect(undoSnapshot.expiredSubscriptionIds).toContain(previousSub.id);

    const revertResponse = await revertEnrollment(jsonRequest("POST", { undoSnapshot }));
    expect(revertResponse.status).toBe(200);

    const activeSubs = await prisma.memberSubscription.findMany({
      where: { memberId: fx.adult.id, status: "ACTIVE" },
    });
    expect(activeSubs).toHaveLength(1);
    expect(activeSubs[0]?.id).toBe(previousSub.id);
  });

  it("blocks revert when attendances exist on created subscriptions", async () => {
    await signIn();
    const fx = await dojoFixture();

    const applyResponse = await applyEnrollment(
      jsonRequest("POST", {
        lines: [
          {
            memberId: fx.adult.id,
            groupId: fx.adultBjj.id,
            planId: fx.bjjPlan.id,
          },
        ],
      }),
    );
    const applyBody = await responseJson(applyResponse);
    expect(applyResponse.status).toBe(201);

    const createdSubId = (
      (applyBody.data as { undoSnapshot: { createdSubscriptionIds: string[] } }).undoSnapshot
        .createdSubscriptionIds[0]
    );
    const session = await createSessionForGroup(fx.adultBjj.id);
    await prisma.attendance.create({
      data: {
        sessionId: session.id,
        memberId: fx.adult.id,
        memberSubscriptionId: createdSubId,
        status: "PRESENT",
      },
    });

    const revertResponse = await revertEnrollment(
      jsonRequest("POST", {
        undoSnapshot: (applyBody.data as { undoSnapshot: Record<string, unknown> }).undoSnapshot,
      }),
    );
    expect(revertResponse.status).toBe(409);
  });
});
