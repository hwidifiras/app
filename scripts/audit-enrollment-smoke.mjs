import fs from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const baseUrl = (process.env.AUDIT_BASE_URL || "https://we-discipline.com").replace(/\/$/, "");
const prefix = process.env.AUDIT_PREFIX || "audit-ux";
const enrollPrefix = process.env.AUDIT_ENROLL_PREFIX || "audit-enroll";
const email = process.env.AUDIT_ADMIN_EMAIL || `${prefix}@we-discipline.test`;
const password = process.env.AUDIT_ADMIN_PASSWORD;
const tenantSlug = process.env.TENANT_SLUG || process.env.DEFAULT_TENANT_SLUG || "we-discipline";
const outputPath = process.env.AUDIT_OUTPUT || "";

if (!password) {
  console.error("AUDIT_ADMIN_PASSWORD is required.");
  process.exit(2);
}

const ids = {
  admin: `${prefix}-admin`,
  group: `${prefix}-group`,
  plan: `${prefix}-plan`,
};

const cookieJar = new Map();
const results = [];
let undoSnapshot = null;
let createdMemberId = null;
let revertCompleted = false;

const suffix = String(Date.now()).slice(-6);
const smokeMember = {
  firstName: "Audit",
  lastName: `Enroll ${suffix}`,
  phone: `${enrollPrefix}-${suffix}`,
  memberType: "ADULT",
};

function splitSetCookieHeader(value) {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,\s]+=)/g).map((cookie) => cookie.trim()).filter(Boolean);
}

function rememberCookies(response) {
  const headers = response.headers;
  const values =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : splitSetCookieHeader(headers.get("set-cookie"));

  for (const value of values) {
    const [pair] = value.split(";");
    const equalsIndex = pair.indexOf("=");
    if (equalsIndex <= 0) continue;
    const name = pair.slice(0, equalsIndex).trim();
    const cookieValue = pair.slice(equalsIndex + 1);
    if (cookieValue === "") cookieJar.delete(name);
    else cookieJar.set(name, cookieValue);
  }
}

function cookieHeader() {
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(route, options = {}) {
  const headers = new Headers(options.headers || {});
  const cookies = cookieHeader();
  if (cookies) headers.set("cookie", cookies);

  let body = options.body;
  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.json);
  }

  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${route}`, {
    method: options.method || "GET",
    headers,
    body,
    redirect: options.redirect || "follow",
  });
  rememberCookies(response);

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // HTML is not expected in this runner.
  }

  return {
    route,
    status: response.status,
    ok: response.ok,
    elapsedMs: Date.now() - startedAt,
    json,
    text: text.slice(0, 500),
  };
}

function addResult(name, passed, expected, actual, notes = "", status = null) {
  results.push({ name, passed, status, expected, actual, notes });
}

async function check(name, fn) {
  try {
    await fn();
  } catch (error) {
    addResult(
      name,
      false,
      "Scenario should complete without an unhandled error.",
      error instanceof Error ? error.message : String(error),
      "Runner exception",
    );
  }
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function enrollmentPayload() {
  return {
    startDate: todayDate(),
    lines: [
      {
        newMember: smokeMember,
        groupId: ids.group,
        planId: ids.plan,
        paymentCents: 1000,
        paymentMethod: "CASH",
        paymentNotes: "Audit enrollment smoke",
      },
    ],
  };
}

async function cleanupCreatedRows() {
  const createdMemberIds = undoSnapshot?.createdMemberIds ?? [];
  const createdSubscriptionIds = undoSnapshot?.createdSubscriptionIds ?? [];
  const createdPaymentIds = undoSnapshot?.createdPaymentIds ?? [];
  const createdGroupMemberIds = undoSnapshot?.createdGroupMemberIds ?? [];
  const offerApplicationId = undoSnapshot?.offerApplicationId ?? null;

  if (!revertCompleted && undoSnapshot) {
    await request("/api/enrollment/revert", {
      method: "POST",
      json: { undoSnapshot },
    }).catch(() => null);
  }

  const staleMembers = await prisma.member.findMany({
    where: { phone: { startsWith: `${enrollPrefix}-` } },
    select: { id: true },
  });
  const memberIds = [...new Set([...createdMemberIds, ...staleMembers.map((member) => member.id)])];
  const staleSubscriptions = await prisma.memberSubscription.findMany({
    where: {
      OR: [
        { id: { in: createdSubscriptionIds } },
        { memberId: { in: memberIds } },
      ],
    },
    select: { id: true },
  });
  const subscriptionIds = [
    ...new Set([...createdSubscriptionIds, ...staleSubscriptions.map((subscription) => subscription.id)]),
  ];

  await prisma.$transaction([
    prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entityId: { in: memberIds } },
          { details: { contains: smokeMember.phone } },
          { details: { contains: smokeMember.lastName } },
        ],
      },
    }),
    prisma.payment.deleteMany({
      where: {
        OR: [
          { id: { in: createdPaymentIds } },
          { memberSubscriptionId: { in: subscriptionIds } },
        ],
      },
    }),
    prisma.memberSubscription.deleteMany({ where: { id: { in: subscriptionIds } } }),
    prisma.groupMember.deleteMany({
      where: {
        OR: [
          { id: { in: createdGroupMemberIds } },
          { memberId: { in: memberIds } },
        ],
      },
    }),
    prisma.offerApplication.deleteMany({ where: offerApplicationId ? { id: offerApplicationId } : { id: "__none__" } }),
    prisma.member.deleteMany({
      where: {
        OR: [
          { id: { in: memberIds } },
          { phone: { startsWith: `${enrollPrefix}-` } },
        ],
      },
    }),
  ]);
}

try {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true, slug: true } });

  await check("Tenant and audit seed records exist", async () => {
    const [group, plan, admin] = await Promise.all([
      prisma.group.findUnique({ where: { id: ids.group }, select: { id: true, tenantId: true, sportId: true, isActive: true } }),
      prisma.subscriptionPlan.findUnique({ where: { id: ids.plan }, select: { id: true, tenantId: true, sportId: true, isActive: true, price: true } }),
      prisma.user.findUnique({ where: { id: ids.admin }, select: { id: true, tenantId: true, email: true, isActive: true } }),
    ]);
    const passed =
      Boolean(tenant) &&
      Boolean(group?.isActive) &&
      Boolean(plan?.isActive) &&
      Boolean(admin?.isActive) &&
      group?.tenantId === tenant?.id &&
      plan?.tenantId === tenant?.id &&
      admin?.tenantId === tenant?.id &&
      group?.sportId === plan?.sportId;
    addResult(
      "Tenant and audit seed records exist",
      passed,
      "Tenant, audit admin, active group, and matching active plan are present.",
      JSON.stringify({ tenant, group, plan, admin: admin ? { ...admin, email: admin.email } : null }),
    );
  });

  await check("No stale smoke member exists before apply", async () => {
    await cleanupCreatedRows();
    const staleCount = await prisma.member.count({ where: { phone: { startsWith: `${enrollPrefix}-` } } });
    addResult(
      "No stale smoke member exists before apply",
      staleCount === 0,
      "Any previous audit-enroll member is removed before the smoke run.",
      JSON.stringify({ staleCount }),
    );
  });

  await check("Audit admin can log in", async () => {
    const response = await request("/api/auth/login", {
      method: "POST",
      json: { email, password },
    });
    addResult(
      "Audit admin can log in",
      response.status === 200 && response.json?.data?.email === email && cookieJar.has("gym_auth"),
      "200, audit email returned, and gym_auth cookie set.",
      JSON.stringify({ body: response.json, cookies: [...cookieJar.keys()] }),
      "",
      response.status,
    );
  });

  await check("Enrollment quote accepts new member line", async () => {
    const response = await request("/api/enrollment/quote", {
      method: "POST",
      json: enrollmentPayload(),
    });
    const line = response.json?.data?.lines?.[0];
    addResult(
      "Enrollment quote accepts new member line",
      response.status === 200 &&
        response.json?.data?.blocked === false &&
        line?.blocked === false &&
        line?.finalAmountCents === 4000,
      "200 quote, not blocked, with the audit plan amount.",
      JSON.stringify(response.json?.data),
      "",
      response.status,
    );
  });

  await check("Enrollment apply creates rollbackable records", async () => {
    const response = await request("/api/enrollment/apply", {
      method: "POST",
      json: enrollmentPayload(),
    });
    undoSnapshot = response.json?.data?.undoSnapshot ?? null;
    createdMemberId = undoSnapshot?.createdMemberIds?.[0] ?? null;
    const passed =
      response.status === 201 &&
      undoSnapshot?.createdMemberIds?.length === 1 &&
      undoSnapshot?.createdSubscriptionIds?.length === 1 &&
      undoSnapshot?.createdPaymentIds?.length === 1 &&
      undoSnapshot?.createdGroupMemberIds?.length === 1;
    addResult(
      "Enrollment apply creates rollbackable records",
      passed,
      "201 with one created member, subscription, payment, and group assignment in undoSnapshot.",
      JSON.stringify({ memberIds: response.json?.data?.memberIds, undoSnapshot }),
      "",
      response.status,
    );
  });

  await check("Created enrollment rows are present before revert", async () => {
    const [member, subscription, payment, groupMember, auditLog] = await Promise.all([
      prisma.member.findUnique({ where: { id: undoSnapshot?.createdMemberIds?.[0] ?? "__none__" } }),
      prisma.memberSubscription.findUnique({ where: { id: undoSnapshot?.createdSubscriptionIds?.[0] ?? "__none__" } }),
      prisma.payment.findUnique({ where: { id: undoSnapshot?.createdPaymentIds?.[0] ?? "__none__" } }),
      prisma.groupMember.findUnique({ where: { id: undoSnapshot?.createdGroupMemberIds?.[0] ?? "__none__" } }),
      prisma.auditLog.findFirst({
        where: {
          action: "ENROLLMENT_APPLIED",
          userId: ids.admin,
          details: { contains: smokeMember.lastName },
        },
      }),
    ]);
    const passed =
      member?.phone === smokeMember.phone &&
      subscription?.memberId === member?.id &&
      subscription?.status === "ACTIVE" &&
      payment?.memberSubscriptionId === subscription?.id &&
      payment?.amount === 1000 &&
      groupMember?.memberId === member?.id &&
      groupMember?.status === "ACTIVE" &&
      Boolean(auditLog);
    addResult(
      "Created enrollment rows are present before revert",
      passed,
      "Member, active subscription, payment, active group assignment, and applied audit log exist.",
      JSON.stringify({
        member: member ? { id: member.id, phone: member.phone } : null,
        subscription: subscription ? { id: subscription.id, status: subscription.status } : null,
        payment: payment ? { id: payment.id, amount: payment.amount } : null,
        groupMember: groupMember ? { id: groupMember.id, status: groupMember.status } : null,
        auditLog: auditLog ? { id: auditLog.id, action: auditLog.action } : null,
      }),
    );
  });

  await check("Enrollment revert succeeds with undoSnapshot", async () => {
    const response = await request("/api/enrollment/revert", {
      method: "POST",
      json: { undoSnapshot },
    });
    revertCompleted = response.status === 200 && response.json?.data?.reverted === true;
    addResult(
      "Enrollment revert succeeds with undoSnapshot",
      revertCompleted,
      "200 with data.reverted=true.",
      JSON.stringify(response.json),
      "",
      response.status,
    );
  });

  await check("Reverted enrollment leaves no created rows", async () => {
    const [member, subscription, payment, groupMember, revertedLog] = await Promise.all([
      prisma.member.findUnique({ where: { id: undoSnapshot?.createdMemberIds?.[0] ?? "__none__" } }),
      prisma.memberSubscription.findUnique({ where: { id: undoSnapshot?.createdSubscriptionIds?.[0] ?? "__none__" } }),
      prisma.payment.findUnique({ where: { id: undoSnapshot?.createdPaymentIds?.[0] ?? "__none__" } }),
      prisma.groupMember.findUnique({ where: { id: undoSnapshot?.createdGroupMemberIds?.[0] ?? "__none__" } }),
      prisma.auditLog.findFirst({
        where: {
          action: "ENROLLMENT_REVERTED",
          userId: ids.admin,
          entityId: createdMemberId ?? "__none__",
        },
      }),
    ]);
    const staleByPhone = await prisma.member.count({ where: { phone: smokeMember.phone } });
    const passed = !member && !subscription && !payment && !groupMember && staleByPhone === 0 && Boolean(revertedLog);
    addResult(
      "Reverted enrollment leaves no created rows",
      passed,
      "Created member, subscription, payment, and group assignment are gone; reverted audit log exists.",
      JSON.stringify({
        member: Boolean(member),
        subscription: Boolean(subscription),
        payment: Boolean(payment),
        groupMember: Boolean(groupMember),
        staleByPhone,
        revertedLog: revertedLog ? { id: revertedLog.id, action: revertedLog.action } : null,
      }),
    );
  });
} finally {
  await cleanupCreatedRows().catch((error) => {
    addResult(
      "Emergency cleanup",
      false,
      "Cleanup of audit-created enrollment rows should not fail.",
      error instanceof Error ? error.message : String(error),
    );
  });

  const passed = results.filter((result) => result.passed).length;
  const failed = results.length - passed;
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    tenantSlug,
    prefix,
    enrollPrefix,
    email,
    smokeMember: { ...smokeMember, id: createdMemberId },
    summary: { total: results.length, passed, failed },
    results,
  };

  const reportText = JSON.stringify(report, null, 2);
  if (outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${reportText}\n`, "utf8");
  }

  console.log(reportText);
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}
