import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PREFIX = process.env.AUDIT_PREFIX?.trim() || "audit-ux";
const tenantSlug = process.env.TENANT_SLUG?.trim() || process.env.DEFAULT_TENANT_SLUG?.trim() || "we-discipline";
const action = (process.argv[2] || process.env.AUDIT_ACTION || "apply").toLowerCase();
const wantsHelp = process.argv.includes("--help") || process.argv.includes("help");
const baseUrl = process.env.AUDIT_BASE_URL?.trim() || "https://we-discipline.com";
const adminPassword = process.env.AUDIT_ADMIN_PASSWORD?.trim();
const auditEmail = process.env.AUDIT_ADMIN_EMAIL?.trim().toLowerCase() || `${PREFIX}@we-discipline.test`;

const ids = {
  admin: `${PREFIX}-admin`,
  sport: `${PREFIX}-sport`,
  coach: `${PREFIX}-coach`,
  coachQualification: `${PREFIX}-coach-qualification`,
  group: `${PREFIX}-group`,
  schedule: `${PREFIX}-schedule`,
  sessionToday: `${PREFIX}-session-today`,
  sessionTomorrow: `${PREFIX}-session-tomorrow`,
  sessionPast: `${PREFIX}-session-past`,
  plan: `${PREFIX}-plan`,
  memberPaid: `${PREFIX}-member-paid`,
  memberPartial: `${PREFIX}-member-partial`,
  memberUnpaid: `${PREFIX}-member-unpaid`,
  memberArchived: `${PREFIX}-member-archived`,
  subPaid: `${PREFIX}-sub-paid`,
  subPartial: `${PREFIX}-sub-partial`,
  subUnpaid: `${PREFIX}-sub-unpaid`,
  payPaid: `${PREFIX}-pay-paid`,
  payPartial: `${PREFIX}-pay-partial`,
  attPaid: `${PREFIX}-att-paid`,
  attPartial: `${PREFIX}-att-partial`,
  attArchived: `${PREFIX}-att-archived`,
  offer: `${PREFIX}-offer`,
};

const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

function utcDay(offsetDays = 0) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays));
}

function plusDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function url(path) {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

async function resolveTenant() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantSlug}`);
  }
  return tenant;
}

async function cleanup(tenantId) {
  await prisma.$transaction([
    prisma.attendance.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.payment.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.offerApplication.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.offer.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.memberSubscription.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.groupMember.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.session.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.groupSchedule.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.coachSportQualification.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.group.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.coach.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.subscriptionPlan.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.sport.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.householdMember.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.household.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.member.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.userPermission.deleteMany({ where: { tenantId, userId: { startsWith: PREFIX } } }),
    prisma.passwordResetToken.deleteMany({ where: { tenantId, userId: { startsWith: PREFIX } } }),
    prisma.notificationRead.deleteMany({ where: { tenantId, userId: { startsWith: PREFIX } } }),
    prisma.user.deleteMany({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.auditLog.deleteMany({
      where: {
        tenantId,
        OR: [{ entityId: { startsWith: PREFIX } }, { userId: { startsWith: PREFIX } }],
      },
    }),
  ]);
}

async function maybeCreateAdmin(tenantId) {
  if (!adminPassword) return null;
  if (adminPassword.length < 8) {
    throw new Error("AUDIT_ADMIN_PASSWORD must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  return prisma.user.upsert({
    where: { id: ids.admin },
    update: {
      tenantId,
      email: auditEmail,
      name: "Audit UX",
      role: "ADMIN",
      isActive: true,
      passwordHash,
    },
    create: {
      id: ids.admin,
      tenantId,
      email: auditEmail,
      name: "Audit UX",
      role: "ADMIN",
      isActive: true,
      passwordHash,
    },
    select: { id: true, email: true },
  });
}

async function apply(tenantId) {
  const today = utcDay(0);
  const tomorrow = utcDay(1);
  const pastSessionDate = utcDay(-1);
  const started = utcDay(-10);
  const ended = utcDay(-2);
  const expires = utcDay(20);
  const todayName = dayNames[today.getUTCDay()];

  await prisma.clubSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      clubName: "Audit UX Club",
      allowCheckInWithPartialPayment: true,
      allowCheckInWithoutSubscription: false,
      absentConsumesSession: true,
    },
    update: {},
  });

  await prisma.sport.upsert({
    where: { id: ids.sport },
    update: { tenantId, name: "Audit UX Kickboxing", isActive: true },
    create: {
      id: ids.sport,
      tenantId,
      name: "Audit UX Kickboxing",
      description: "Temporary UI audit discipline",
      isActive: true,
    },
  });

  await prisma.coach.upsert({
    where: { id: ids.coach },
    update: {
      tenantId,
      firstName: "Audit",
      lastName: "Coach",
      phone: `${PREFIX}-coach-phone`,
      sportId: ids.sport,
      isActive: true,
    },
    create: {
      id: ids.coach,
      tenantId,
      firstName: "Audit",
      lastName: "Coach",
      phone: `${PREFIX}-coach-phone`,
      email: `${PREFIX}-coach@we-discipline.test`,
      sportId: ids.sport,
      isActive: true,
    },
  });

  await prisma.coachSportQualification.upsert({
    where: { id: ids.coachQualification },
    update: { tenantId, coachId: ids.coach, sportId: ids.sport, isPrimary: true },
    create: {
      id: ids.coachQualification,
      tenantId,
      coachId: ids.coach,
      sportId: ids.sport,
      isPrimary: true,
      notes: "Temporary UI audit qualification",
    },
  });

  await prisma.group.upsert({
    where: { id: ids.group },
    update: {
      tenantId,
      name: "Audit UX Adultes",
      groupType: "ADULTS",
      sportId: ids.sport,
      coachId: ids.coach,
      capacity: 12,
      room: "Salle audit",
      isActive: true,
    },
    create: {
      id: ids.group,
      tenantId,
      name: "Audit UX Adultes",
      groupType: "ADULTS",
      sportId: ids.sport,
      coachId: ids.coach,
      capacity: 12,
      room: "Salle audit",
      isActive: true,
    },
  });

  await prisma.groupSchedule.upsert({
    where: { id: ids.schedule },
    update: {
      tenantId,
      groupId: ids.group,
      dayOfWeek: todayName,
      startTime: "10:00",
      durationMinutes: 90,
      effectiveFrom: started,
      effectiveTo: null,
    },
    create: {
      id: ids.schedule,
      tenantId,
      groupId: ids.group,
      dayOfWeek: todayName,
      startTime: "10:00",
      durationMinutes: 90,
      effectiveFrom: started,
    },
  });

  await prisma.subscriptionPlan.upsert({
    where: { id: ids.plan },
    update: {
      tenantId,
      name: "Audit UX 8 seances",
      price: 4000,
      totalSessions: 8,
      sessionsPerWeek: 2,
      validityDays: 30,
      sportId: ids.sport,
      isActive: true,
    },
    create: {
      id: ids.plan,
      tenantId,
      name: "Audit UX 8 seances",
      description: "Temporary UI audit formula",
      price: 4000,
      totalSessions: 8,
      sessionsPerWeek: 2,
      validityDays: 30,
      sportId: ids.sport,
      isActive: true,
    },
  });

  const members = [
    [ids.memberPaid, "Audit Lina", "Payee", `${PREFIX}-phone-paid`, "ACTIVE"],
    [ids.memberPartial, "Audit Sami", "Partiel", `${PREFIX}-phone-partial`, "ACTIVE"],
    [ids.memberUnpaid, "Audit Noor", "Dette", `${PREFIX}-phone-unpaid`, "ACTIVE"],
    [ids.memberArchived, "Audit Archive", "Ferme", `${PREFIX}-phone-archived`, "ARCHIVED"],
  ];

  for (const [id, firstName, lastName, phone, status] of members) {
    await prisma.member.upsert({
      where: { id },
      update: {
        tenantId,
        firstName,
        lastName,
        phone,
        email: `${id}@we-discipline.test`,
        memberType: "ADULT",
        status,
        archivedAt: status === "ARCHIVED" ? ended : null,
      },
      create: {
        id,
        tenantId,
        firstName,
        lastName,
        phone,
        email: `${id}@we-discipline.test`,
        memberType: "ADULT",
        status,
        joinedAt: started,
        archivedAt: status === "ARCHIVED" ? ended : null,
      },
    });
  }

  const groupMembers = [
    [`${PREFIX}-gm-paid`, ids.memberPaid, "ACTIVE", started, null],
    [`${PREFIX}-gm-partial`, ids.memberPartial, "ACTIVE", started, null],
    [`${PREFIX}-gm-unpaid`, ids.memberUnpaid, "ACTIVE", started, null],
    [`${PREFIX}-gm-archived`, ids.memberArchived, "INACTIVE", started, ended],
  ];

  for (const [id, memberId, status, startDate, endDate] of groupMembers) {
    await prisma.groupMember.upsert({
      where: { id },
      update: { tenantId, groupId: ids.group, memberId, status, startDate, endDate },
      create: { id, tenantId, groupId: ids.group, memberId, status, startDate, endDate },
    });
  }

  const subscriptions = [
    [ids.subPaid, ids.memberPaid, 4000, 4],
    [ids.subPartial, ids.memberPartial, 4000, 5],
    [ids.subUnpaid, ids.memberUnpaid, 4000, 6],
  ];

  for (const [id, memberId, amount, remainingSessions] of subscriptions) {
    await prisma.memberSubscription.upsert({
      where: { id },
      update: {
        tenantId,
        memberId,
        planId: ids.plan,
        sportId: ids.sport,
        startDate: started,
        endDate: expires,
        amount,
        remainingSessions,
        status: "ACTIVE",
      },
      create: {
        id,
        tenantId,
        memberId,
        planId: ids.plan,
        sportId: ids.sport,
        startDate: started,
        endDate: expires,
        amount,
        remainingSessions,
        status: "ACTIVE",
      },
    });
  }

  await prisma.payment.upsert({
    where: { id: ids.payPaid },
    update: {
      tenantId,
      memberSubscriptionId: ids.subPaid,
      amount: 4000,
      paymentMethod: "CASH",
      paymentDate: started,
      notes: "Temporary UI audit full payment",
    },
    create: {
      id: ids.payPaid,
      tenantId,
      memberSubscriptionId: ids.subPaid,
      amount: 4000,
      paymentMethod: "CASH",
      paymentDate: started,
      notes: "Temporary UI audit full payment",
    },
  });

  await prisma.payment.upsert({
    where: { id: ids.payPartial },
    update: {
      tenantId,
      memberSubscriptionId: ids.subPartial,
      amount: 2000,
      paymentMethod: "CASH",
      paymentDate: started,
      notes: "Temporary UI audit partial payment",
    },
    create: {
      id: ids.payPartial,
      tenantId,
      memberSubscriptionId: ids.subPartial,
      amount: 2000,
      paymentMethod: "CASH",
      paymentDate: started,
      notes: "Temporary UI audit partial payment",
    },
  });

  await prisma.session.upsert({
    where: { id: ids.sessionToday },
    update: {
      tenantId,
      groupId: ids.group,
      scheduleId: ids.schedule,
      sessionDate: today,
      startTime: "10:00",
      endTime: "11:30",
      coachId: ids.coach,
      room: "Salle audit",
      status: "PLANNED",
    },
    create: {
      id: ids.sessionToday,
      tenantId,
      groupId: ids.group,
      scheduleId: ids.schedule,
      sessionDate: today,
      startTime: "10:00",
      endTime: "11:30",
      coachId: ids.coach,
      room: "Salle audit",
      status: "PLANNED",
    },
  });

  await prisma.session.upsert({
    where: { id: ids.sessionTomorrow },
    update: {
      tenantId,
      groupId: ids.group,
      scheduleId: ids.schedule,
      sessionDate: tomorrow,
      startTime: "10:00",
      endTime: "11:30",
      coachId: ids.coach,
      room: "Salle audit",
      status: "PLANNED",
    },
    create: {
      id: ids.sessionTomorrow,
      tenantId,
      groupId: ids.group,
      scheduleId: ids.schedule,
      sessionDate: tomorrow,
      startTime: "10:00",
      endTime: "11:30",
      coachId: ids.coach,
      room: "Salle audit",
      status: "PLANNED",
    },
  });

  await prisma.session.upsert({
    where: { id: ids.sessionPast },
    update: {
      tenantId,
      groupId: ids.group,
      scheduleId: ids.schedule,
      sessionDate: pastSessionDate,
      startTime: "08:00",
      endTime: "09:00",
      coachId: ids.coach,
      room: "Salle audit",
      status: "PLANNED",
    },
    create: {
      id: ids.sessionPast,
      tenantId,
      groupId: ids.group,
      scheduleId: ids.schedule,
      sessionDate: pastSessionDate,
      startTime: "08:00",
      endTime: "09:00",
      coachId: ids.coach,
      room: "Salle audit",
      status: "PLANNED",
    },
  });

  const attendances = [
    [ids.attPaid, ids.memberPaid, ids.subPaid, "PRESENT", null],
    [ids.attPartial, ids.memberPartial, ids.subPartial, "ABSENT", null],
    [ids.attArchived, ids.memberArchived, null, "PRESENT", "Historique avant archivage"],
  ];

  for (const [id, memberId, memberSubscriptionId, status, overrideReason] of attendances) {
    await prisma.attendance.upsert({
      where: { id },
      update: {
        tenantId,
        sessionId: ids.sessionToday,
        memberId,
        memberSubscriptionId,
        status,
        checkedBy: ids.admin,
        checkedAt: plusDays(today, 0),
        overrideReason,
      },
      create: {
        id,
        tenantId,
        sessionId: ids.sessionToday,
        memberId,
        memberSubscriptionId,
        status,
        checkedBy: ids.admin,
        checkedAt: plusDays(today, 0),
        overrideReason,
      },
    });
  }

  await prisma.offer.upsert({
    where: { id: ids.offer },
    update: {
      tenantId,
      name: "Audit UX Famille",
      description: "Temporary UI audit offer",
      kind: "FAMILY_BUNDLE",
      isActive: true,
      rules: JSON.stringify({ minMembers: 2, bundlePriceCents: 7000, requiresHousehold: false }),
      minMembers: 2,
      bundlePriceCents: 7000,
      requiresHousehold: false,
      sportId: ids.sport,
    },
    create: {
      id: ids.offer,
      tenantId,
      name: "Audit UX Famille",
      description: "Temporary UI audit offer",
      kind: "FAMILY_BUNDLE",
      isActive: true,
      rules: JSON.stringify({ minMembers: 2, bundlePriceCents: 7000, requiresHousehold: false }),
      minMembers: 2,
      bundlePriceCents: 7000,
      requiresHousehold: false,
      sportId: ids.sport,
    },
  });

  const admin = await maybeCreateAdmin(tenantId);
  return { today, tomorrow, pastSessionDate, admin };
}

async function status(tenantId) {
  const [members, sessions, attendances, payments, offers, users] = await Promise.all([
    prisma.member.count({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.session.count({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.attendance.count({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.payment.count({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.offer.count({ where: { tenantId, id: { startsWith: PREFIX } } }),
    prisma.user.count({ where: { tenantId, id: { startsWith: PREFIX } } }),
  ]);
  return { members, sessions, attendances, payments, offers, users };
}

function printUsage() {
  console.log(`Usage:
  node scripts/seed-audit-ux-data.mjs apply
  node scripts/seed-audit-ux-data.mjs status
  node scripts/seed-audit-ux-data.mjs cleanup

Environment:
  TENANT_SLUG=we-discipline
  AUDIT_BASE_URL=https://we-discipline.com
  AUDIT_ADMIN_EMAIL=audit-ux@we-discipline.test
  AUDIT_ADMIN_PASSWORD=temporary-password
  AUDIT_PREFIX=audit-ux
`);
}

try {
  if (wantsHelp) {
    printUsage();
    process.exit(0);
  }

  if (!["apply", "status", "cleanup"].includes(action)) {
    printUsage();
    throw new Error(`Unknown action: ${action}`);
  }

  const tenant = await resolveTenant();

  if (action === "cleanup") {
    await cleanup(tenant.id);
    console.log(JSON.stringify({ action, tenant: tenant.slug, cleanedPrefix: PREFIX }, null, 2));
  } else if (action === "status") {
    console.log(JSON.stringify({ action, tenant: tenant.slug, counts: await status(tenant.id) }, null, 2));
  } else {
    await cleanup(tenant.id);
    const result = await apply(tenant.id);
    console.log(
      JSON.stringify(
        {
          action,
          tenant: tenant.slug,
          prefix: PREFIX,
          admin: result.admin ? { email: result.admin.email, passwordFromEnv: "AUDIT_ADMIN_PASSWORD" } : null,
          urls: {
            dashboard: url("/"),
            paymentNew: url(`/payments/new?memberId=${ids.memberPartial}`),
            attendanceDetail: url(`/attendance/sessions/${ids.sessionToday}`),
            finalizableAttendanceDetail: url(`/attendance/sessions/${ids.sessionPast}`),
            attendanceToday: url(`/attendance/today?sessionId=${ids.sessionToday}`),
            sessionPostponeRedirect: url(`/sessions/${ids.sessionTomorrow}/postpone`),
            offers: url("/offers"),
            importSettings: url("/settings/data-import"),
          },
          counts: await status(tenant.id),
        },
        null,
        2,
      ),
    );
  }
} finally {
  await prisma.$disconnect();
}
