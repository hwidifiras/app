import { createHash } from "node:crypto";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BUSINESS_TABLES = [
  "Tenant",
  "User",
  "UserPermission",
  "ClubSettings",
  "Member",
  "Household",
  "HouseholdMember",
  "Sport",
  "Coach",
  "CoachSportQualification",
  "Group",
  "GroupMember",
  "GroupSchedule",
  "ScheduleTemplate",
  "ScheduleTemplateSlot",
  "Session",
  "SubscriptionPlan",
  "PlanEntitlement",
  "MemberSubscription",
  "SubscriptionEntitlement",
  "Payment",
  "Receipt",
  "Offer",
  "OfferApplication",
  "Attendance",
  "AuditLog",
  "GymVisit",
];

const PLATFORM_TABLES = [
  "TenantModule",
  "SubscriptionPause",
  "EntitlementAdjustment",
  "MemberAccessCredential",
  "GymAccessAttempt",
  "SaasPlan",
  "SaasPlanModule",
  "TenantSaasSubscription",
  "PlatformAuditLog",
];

function quoteIdentifier(identifier) {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return `"${identifier}"`;
}

function idDigest(ids) {
  return createHash("sha256").update(ids.join("\n")).digest("hex");
}

function isMissingTable(error) {
  return error && typeof error === "object" && "code" in error && error.code === "P2010"
    && "meta" in error && error.meta?.code === "42P01";
}

async function tableSnapshot(table) {
  try {
    const rows = await prisma.$queryRawUnsafe(`SELECT "id" FROM ${quoteIdentifier(table)} ORDER BY "id"`);
    const ids = rows.map((row) => String(row.id));
    return { present: true, count: ids.length, idDigest: idDigest(ids) };
  } catch (error) {
    if (isMissingTable(error)) return { present: false, count: 0, idDigest: null };
    throw error;
  }
}

async function groupedRows(sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, typeof value === "bigint" ? value.toString() : value]),
  ));
}

async function main() {
  const businessTables = {};
  for (const table of BUSINESS_TABLES) businessTables[table] = await tableSnapshot(table);

  const platformTables = {};
  for (const table of PLATFORM_TABLES) platformTables[table] = await tableSnapshot(table);

  const [payments, subscriptions, attendanceByStatus, sessionsByStatus, modules, migrations] = await Promise.all([
    groupedRows(`
      SELECT
        "tenantId" AS "tenantId",
        COUNT(*) AS "entries",
        COALESCE(SUM("amount"), 0) AS "signedAmountCents"
      FROM "Payment"
      GROUP BY "tenantId"
      ORDER BY "tenantId"
    `),
    groupedRows(`
      SELECT
        "tenantId" AS "tenantId",
        COUNT(*) AS "subscriptions",
        COALESCE(SUM("amount"), 0) AS "soldAmountCents",
        COALESCE(SUM("remainingSessions"), 0) AS "remainingSessions"
      FROM "MemberSubscription"
      GROUP BY "tenantId"
      ORDER BY "tenantId"
    `),
    groupedRows(`
      SELECT "tenantId" AS "tenantId", "status"::text AS "status", COUNT(*) AS "count"
      FROM "Attendance"
      GROUP BY "tenantId", "status"
      ORDER BY "tenantId", "status"
    `),
    groupedRows(`
      SELECT "tenantId" AS "tenantId", "status"::text AS "status", COUNT(*) AS "count"
      FROM "Session"
      GROUP BY "tenantId", "status"
      ORDER BY "tenantId", "status"
    `),
    groupedRows(`
      SELECT "tenantId" AS "tenantId", "moduleKey"::text AS "moduleKey", "status"::text AS "status"
      FROM "TenantModule"
      ORDER BY "tenantId", "moduleKey"
    `),
    groupedRows(`
      SELECT "migration_name" AS "migrationName"
      FROM "_prisma_migrations"
      WHERE "finished_at" IS NOT NULL
      ORDER BY "migration_name"
    `),
  ]);

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    businessTables,
    platformTables,
    financials: { payments, subscriptions },
    attendanceByStatus,
    sessionsByStatus,
    modules,
    migrations: migrations.map((row) => row.migrationName),
  }, null, 2));
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
