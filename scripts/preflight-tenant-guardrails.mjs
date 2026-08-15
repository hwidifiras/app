import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });

const tenantScopedTables = [
  "User",
  "UserPermission",
  "PasswordResetToken",
  "NotificationRead",
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
  "MemberSubscription",
  "PlanEntitlement",
  "SubscriptionEntitlement",
  "Payment",
  "Receipt",
  "Offer",
  "OfferApplication",
  "Attendance",
  "AuditLog",
];

const tenantScopedRelations = [
  ["UserPermission", "userId", "User"],
  ["PasswordResetToken", "userId", "User"],
  ["NotificationRead", "userId", "User"],
  ["HouseholdMember", "householdId", "Household"],
  ["HouseholdMember", "memberId", "Member"],
  ["Coach", "sportId", "Sport"],
  ["CoachSportQualification", "coachId", "Coach"],
  ["CoachSportQualification", "sportId", "Sport"],
  ["Group", "sportId", "Sport"],
  ["Group", "coachId", "Coach"],
  ["GroupMember", "groupId", "Group"],
  ["GroupMember", "memberId", "Member"],
  ["GroupSchedule", "groupId", "Group"],
  ["ScheduleTemplateSlot", "templateId", "ScheduleTemplate"],
  ["Session", "groupId", "Group"],
  ["Session", "scheduleId", "GroupSchedule"],
  ["Session", "coachId", "Coach"],
  ["SubscriptionPlan", "sportId", "Sport"],
  ["MemberSubscription", "memberId", "Member"],
  ["MemberSubscription", "planId", "SubscriptionPlan"],
  ["MemberSubscription", "sportId", "Sport"],
  ["MemberSubscription", "offerApplicationId", "OfferApplication"],
  ["PlanEntitlement", "planId", "SubscriptionPlan"],
  ["PlanEntitlement", "sportId", "Sport"],
  ["SubscriptionEntitlement", "memberSubscriptionId", "MemberSubscription"],
  ["SubscriptionEntitlement", "planEntitlementId", "PlanEntitlement"],
  ["SubscriptionEntitlement", "sportId", "Sport"],
  ["Payment", "memberSubscriptionId", "MemberSubscription"],
  ["Payment", "correctsPaymentId", "Payment"],
  ["Payment", "createdById", "User"],
  ["Receipt", "paymentId", "Payment"],
  ["Receipt", "issuedById", "User"],
  ["Offer", "sportId", "Sport"],
  ["Offer", "createdById", "User"],
  ["OfferApplication", "offerId", "Offer"],
  ["OfferApplication", "createdById", "User"],
  ["Attendance", "sessionId", "Session"],
  ["Attendance", "memberId", "Member"],
  ["Attendance", "memberSubscriptionId", "MemberSubscription"],
  ["Attendance", "subscriptionEntitlementId", "SubscriptionEntitlement"],
  ["GymVisit", "memberId", "Member"],
  ["GymVisit", "memberSubscriptionId", "MemberSubscription"],
  ["GymVisit", "subscriptionEntitlementId", "SubscriptionEntitlement"],
  ["GymVisit", "correctsVisitId", "GymVisit"],
  ["GymVisit", "checkedById", "User"],
  ["AuditLog", "userId", "User"],
];

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

try {
  const nullTenantOffenders = [];
  const relationOffenders = [];

  for (const table of tenantScopedTables) {
    const relation = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('${quoteIdentifier(table)}')::text AS name`,
    );
    if (!relation[0]?.name) continue;

    const rows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::INTEGER AS count FROM ${quoteIdentifier(table)} WHERE "tenantId" IS NULL`,
    );
    const count = Number(rows[0]?.count ?? 0);
    if (count > 0) nullTenantOffenders.push({ table, count });
  }

  for (const [childTable, foreignColumn, parentTable] of tenantScopedRelations) {
    const childRelation = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('${quoteIdentifier(childTable)}')::text AS name`,
    );
    const parentRelation = await prisma.$queryRawUnsafe(
      `SELECT to_regclass('${quoteIdentifier(parentTable)}')::text AS name`,
    );
    if (!childRelation[0]?.name || !parentRelation[0]?.name) continue;

    const rows = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::INTEGER AS count
       FROM ${quoteIdentifier(childTable)} AS child
       JOIN ${quoteIdentifier(parentTable)} AS parent
         ON parent."id" = child.${quoteIdentifier(foreignColumn)}
       WHERE child.${quoteIdentifier(foreignColumn)} IS NOT NULL
         AND child."tenantId" IS DISTINCT FROM parent."tenantId"`,
    );
    const count = Number(rows[0]?.count ?? 0);
    if (count > 0) relationOffenders.push({ childTable, foreignColumn, parentTable, count });
  }

  if (nullTenantOffenders.length > 0 || relationOffenders.length > 0) {
    console.error("Tenant guardrail preflight failed: legacy tenant inconsistencies must be repaired before deployment.");
    for (const offender of nullTenantOffenders) {
      console.error(`- ${offender.table}: ${offender.count} row(s) with tenantId IS NULL`);
    }
    for (const offender of relationOffenders) {
      console.error(
        `- ${offender.childTable}.${offender.foreignColumn} -> ${offender.parentTable}: `
        + `${offender.count} cross-tenant reference(s)`,
      );
    }
    console.error("Restore/backfill the correct tenantId values, rerun this command, then deploy migrations.");
    process.exitCode = 1;
  } else {
    console.log("Tenant guardrail preflight passed (tenant IDs and guarded references are consistent).");
  }
} finally {
  await prisma.$disconnect();
}
