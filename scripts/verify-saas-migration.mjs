import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";

const sqlitePath = process.env.SQLITE_SOURCE_PATH ?? process.argv[2];
const tenantSlug = process.env.DEFAULT_TENANT_SLUG?.trim() || process.env.TENANT_SLUG?.trim() || "we-discipline";

if (!sqlitePath) {
  console.error("SQLITE_SOURCE_PATH or first positional argument is required.");
  process.exit(1);
}

if (!existsSync(sqlitePath)) {
  console.error(`SQLite source not found: ${sqlitePath}`);
  process.exit(1);
}

const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
const prisma = new PrismaClient();

const modelChecks = [
  ["User", "user"],
  ["Member", "member"],
  ["Sport", "sport"],
  ["Coach", "coach"],
  ["CoachSportQualification", "coachSportQualification"],
  ["Group", "group"],
  ["GroupMember", "groupMember"],
  ["GroupSchedule", "groupSchedule"],
  ["Session", "session"],
  ["SubscriptionPlan", "subscriptionPlan"],
  ["MemberSubscription", "memberSubscription"],
  ["Payment", "payment"],
  ["Offer", "offer"],
  ["OfferApplication", "offerApplication"],
  ["Attendance", "attendance"],
  ["AuditLog", "auditLog"],
];

function tableExists(table) {
  const row = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return Boolean(row);
}

function sqliteCount(table, where = "") {
  if (!tableExists(table)) return 0;
  const suffix = where ? ` WHERE ${where}` : "";
  return Number(sqlite.prepare(`SELECT COUNT(*) AS count FROM "${table}"${suffix}`).get().count);
}

function sqliteSum(table, column, where = "") {
  if (!tableExists(table)) return 0;
  const suffix = where ? ` WHERE ${where}` : "";
  return Number(sqlite.prepare(`SELECT COALESCE(SUM("${column}"), 0) AS total FROM "${table}"${suffix}`).get().total);
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  const mismatches = [];
  const counts = {};

  for (const [table, model] of modelChecks) {
    const source = sqliteCount(table);
    const target = await prisma[model].count({ where: { tenantId: tenant.id } });
    counts[table] = { source, target };
    if (source !== target) mismatches.push(`${table}: source=${source} target=${target}`);
  }

  const sourcePaymentTotal = sqliteSum("Payment", "amount");
  const targetPayment = await prisma.payment.aggregate({
    where: { tenantId: tenant.id },
    _sum: { amount: true },
  });
  const targetPaymentTotal = targetPayment._sum.amount ?? 0;
  if (sourcePaymentTotal !== targetPaymentTotal) {
    mismatches.push(`Payment amount total: source=${sourcePaymentTotal} target=${targetPaymentTotal}`);
  }

  const sourceActiveSubscriptions = sqliteCount("MemberSubscription", `"status" = 'ACTIVE'`);
  const targetActiveSubscriptions = await prisma.memberSubscription.count({
    where: { tenantId: tenant.id, status: "ACTIVE" },
  });
  if (sourceActiveSubscriptions !== targetActiveSubscriptions) {
    mismatches.push(
      `Active subscriptions: source=${sourceActiveSubscriptions} target=${targetActiveSubscriptions}`,
    );
  }

  const sourceLoginReady = sqliteCount("User", `"isActive" = 1 AND "passwordHash" IS NOT NULL AND "passwordHash" != ''`);
  const targetLoginReady = await prisma.user.count({
    where: {
      tenantId: tenant.id,
      isActive: true,
      passwordHash: { not: "" },
    },
  });
  if (sourceLoginReady !== targetLoginReady) {
    mismatches.push(`Login-ready users: source=${sourceLoginReady} target=${targetLoginReady}`);
  }

  const result = {
    tenant: { id: tenant.id, slug: tenant.slug },
    counts,
    totals: {
      sourcePaymentTotal,
      targetPaymentTotal,
      sourceActiveSubscriptions,
      targetActiveSubscriptions,
      sourceLoginReady,
      targetLoginReady,
    },
  };

  if (mismatches.length > 0) {
    console.error(JSON.stringify({ ok: false, mismatches, ...result }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    sqlite.close();
    await prisma.$disconnect();
  });
