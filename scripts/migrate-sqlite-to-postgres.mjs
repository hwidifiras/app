import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";

const sqlitePath = process.env.SQLITE_SOURCE_PATH ?? process.argv[2];
const tenantSlug = process.env.DEFAULT_TENANT_SLUG?.trim() || process.env.TENANT_SLUG?.trim() || "we-discipline";
const tenantId = process.env.DEFAULT_TENANT_ID?.trim() || process.env.TENANT_ID?.trim() || `tenant_${tenantSlug.replace(/[^a-z0-9_-]/gi, "_")}`;
const tenantName = process.env.DEFAULT_TENANT_NAME?.trim() || process.env.TENANT_NAME?.trim() || "We Discipline";
const rootDomainAlias = process.env.DEFAULT_TENANT_ROOT_ALIAS?.trim() || process.env.TENANT_ROOT_DOMAIN_ALIAS?.trim() || "we-discipline.com";

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

const dateFields = new Set([
  "expiresAt",
  "usedAt",
  "readAt",
  "updatedAt",
  "joinedAt",
  "archivedAt",
  "createdAt",
  "birthDate",
  "effectiveFrom",
  "effectiveTo",
  "sessionDate",
  "postponedTo",
  "startDate",
  "endDate",
  "paymentDate",
  "checkedAt",
]);

const boolFields = new Set([
  "isActive",
  "allowCheckInWithPartialPayment",
  "allowCheckInWithoutSubscription",
  "absentConsumesSession",
  "allowPublicRegister",
  "isPrimary",
  "requiresHousehold",
]);

const intFields = new Set([
  "maxStaffDiscountPercent",
  "debtAlertThresholdCents",
  "capacity",
  "durationMinutes",
  "price",
  "totalSessions",
  "sessionsPerWeek",
  "validityDays",
  "amount",
  "listPriceCents",
  "discountCents",
  "remainingSessions",
  "percentOff",
  "amountOffCents",
  "bundlePriceCents",
  "minMembers",
  "maxMembers",
]);

function tableExists(table) {
  const row = sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return Boolean(row);
}

function rows(table) {
  if (!tableExists(table)) return [];
  return sqlite.prepare(`SELECT * FROM "${table}"`).all();
}

function toDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    return new Date(value < 10_000_000_000 ? value * 1000 : value);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toBool(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value === "true" || value === "1";
  return Boolean(value);
}

function clean(data) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function convertField(field, value) {
  if (value === undefined) return undefined;
  if (dateFields.has(field)) return toDate(value);
  if (boolFields.has(field)) return toBool(value);
  if (intFields.has(field)) return value === null || value === "" ? null : Number(value);
  return value;
}

function dataFromRow(row, fields, { tenant = true } = {}) {
  const data = tenant ? { tenantId } : {};
  for (const field of fields) {
    data[field] = convertField(field, row[field]);
  }
  return clean(data);
}

function withoutId(data) {
  const rest = { ...data };
  delete rest.id;
  return rest;
}

async function upsertById(modelName, table, fields, options) {
  const delegate = prisma[modelName];
  const sourceRows = rows(table);
  for (const row of sourceRows) {
    const data = dataFromRow(row, fields, options);
    await delegate.upsert({
      where: { id: row.id },
      create: data,
      update: withoutId(data),
    });
  }
  return sourceRows.length;
}

async function main() {
  console.log(`Migrating ${sqlitePath} into tenant ${tenantSlug} (${tenantId})`);

  await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    create: {
      id: tenantId,
      slug: tenantSlug,
      name: tenantName,
      rootDomainAlias,
      status: "ACTIVE",
    },
    update: {
      name: tenantName,
      rootDomainAlias,
      status: "ACTIVE",
    },
  });

  const settingsRows = rows("ClubSettings");
  const settings = settingsRows[0] ?? {};
  await prisma.clubSettings.upsert({
    where: { tenantId },
    create: dataFromRow(
      { id: settings.id ?? `settings_${tenantId}`, ...settings },
      [
        "id",
        "clubName",
        "clubLogoUrl",
        "clubAddress",
        "clubPhone",
        "allowCheckInWithPartialPayment",
        "allowCheckInWithoutSubscription",
        "absentConsumesSession",
        "allowPublicRegister",
        "maxStaffDiscountPercent",
        "debtAlertThresholdCents",
        "updatedAt",
      ],
    ),
    update: withoutId(
      dataFromRow(settings, [
        "clubName",
        "clubLogoUrl",
        "clubAddress",
        "clubPhone",
        "allowCheckInWithPartialPayment",
        "allowCheckInWithoutSubscription",
        "absentConsumesSession",
        "allowPublicRegister",
        "maxStaffDiscountPercent",
        "debtAlertThresholdCents",
        "updatedAt",
      ]),
    ),
  });

  const results = {};
  results.users = await upsertById("user", "User", [
    "id",
    "email",
    "name",
    "passwordHash",
    "role",
    "isActive",
    "createdAt",
    "updatedAt",
  ]);
  results.userPermissions = await upsertById("userPermission", "UserPermission", ["id", "userId", "key", "createdAt"]);
  results.passwordResetTokens = await upsertById("passwordResetToken", "PasswordResetToken", [
    "id",
    "userId",
    "tokenHash",
    "expiresAt",
    "usedAt",
    "createdAt",
  ]);
  results.notificationReads = await upsertById("notificationRead", "NotificationRead", [
    "id",
    "userId",
    "notificationKey",
    "readAt",
    "updatedAt",
  ]);
  results.members = await upsertById("member", "Member", [
    "id",
    "firstName",
    "lastName",
    "phone",
    "email",
    "memberType",
    "birthDate",
    "address",
    "parentName",
    "parentPhone",
    "parentAddress",
    "status",
    "joinedAt",
    "archivedAt",
    "createdAt",
    "updatedAt",
  ]);
  results.households = await upsertById("household", "Household", ["id", "label", "createdAt", "updatedAt"]);
  results.householdMembers = await upsertById("householdMember", "HouseholdMember", [
    "id",
    "householdId",
    "memberId",
    "relationship",
    "createdAt",
  ]);
  results.sports = await upsertById("sport", "Sport", ["id", "name", "description", "isActive", "createdAt", "updatedAt"]);
  results.coaches = await upsertById("coach", "Coach", [
    "id",
    "firstName",
    "lastName",
    "phone",
    "email",
    "isActive",
    "sportId",
    "createdAt",
    "updatedAt",
  ]);
  results.coachQualifications = await upsertById("coachSportQualification", "CoachSportQualification", [
    "id",
    "coachId",
    "sportId",
    "isPrimary",
    "notes",
    "createdAt",
    "updatedAt",
  ]);
  results.groups = await upsertById("group", "Group", [
    "id",
    "name",
    "groupType",
    "sportId",
    "coachId",
    "capacity",
    "room",
    "isActive",
    "createdAt",
    "updatedAt",
  ]);
  results.groupSchedules = await upsertById("groupSchedule", "GroupSchedule", [
    "id",
    "groupId",
    "dayOfWeek",
    "startTime",
    "durationMinutes",
    "effectiveFrom",
    "effectiveTo",
    "createdAt",
    "updatedAt",
  ]);
  results.sessions = await upsertById("session", "Session", [
    "id",
    "groupId",
    "scheduleId",
    "sessionDate",
    "startTime",
    "endTime",
    "coachId",
    "room",
    "status",
    "exceptionReason",
    "postponedTo",
    "postponementReason",
    "postponementDetails",
    "createdAt",
    "updatedAt",
  ]);
  results.subscriptionPlans = await upsertById("subscriptionPlan", "SubscriptionPlan", [
    "id",
    "name",
    "description",
    "price",
    "totalSessions",
    "sessionsPerWeek",
    "validityDays",
    "isActive",
    "sportId",
    "createdAt",
    "updatedAt",
  ]);
  results.offers = await upsertById("offer", "Offer", [
    "id",
    "name",
    "description",
    "kind",
    "isActive",
    "rules",
    "percentOff",
    "amountOffCents",
    "bundlePriceCents",
    "minMembers",
    "requiresHousehold",
    "maxMembers",
    "sportId",
    "createdById",
    "createdAt",
    "updatedAt",
  ]);
  results.offerApplications = await upsertById("offerApplication", "OfferApplication", [
    "id",
    "offerId",
    "memberIds",
    "subscriptionIds",
    "quoteSnapshot",
    "createdById",
    "createdAt",
  ]);
  results.memberSubscriptions = await upsertById("memberSubscription", "MemberSubscription", [
    "id",
    "memberId",
    "planId",
    "sportId",
    "startDate",
    "endDate",
    "amount",
    "listPriceCents",
    "discountCents",
    "offerApplicationId",
    "offerName",
    "remainingSessions",
    "status",
    "createdAt",
    "updatedAt",
  ]);
  results.groupMembers = await upsertById("groupMember", "GroupMember", [
    "id",
    "groupId",
    "memberId",
    "startDate",
    "endDate",
    "status",
    "createdAt",
    "updatedAt",
  ]);
  results.payments = await upsertById("payment", "Payment", [
    "id",
    "memberSubscriptionId",
    "amount",
    "entryType",
    "correctsPaymentId",
    "correctionReason",
    "createdById",
    "paymentDate",
    "paymentMethod",
    "notes",
    "createdAt",
    "updatedAt",
  ]);
  results.attendances = await upsertById("attendance", "Attendance", [
    "id",
    "sessionId",
    "memberId",
    "memberSubscriptionId",
    "status",
    "overrideReason",
    "checkedBy",
    "checkedAt",
    "createdAt",
    "updatedAt",
  ]);
  results.auditLogs = await upsertById("auditLog", "AuditLog", [
    "id",
    "action",
    "entityType",
    "entityId",
    "userId",
    "details",
    "createdAt",
  ]);

  console.log(JSON.stringify({ tenantId, tenantSlug, imported: results }, null, 2));
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
