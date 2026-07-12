CREATE TYPE "PlanKind" AS ENUM ('CLASS', 'GYM', 'MIXED');
CREATE TYPE "EntitlementType" AS ENUM ('CLASS_SESSIONS', 'GYM_ACCESS');
CREATE TYPE "GymAccessMode" AS ENUM ('UNLIMITED', 'VISIT_QUOTA');
CREATE TYPE "GymVisitEntryType" AS ENUM ('CHECK_IN', 'REVERSAL');
CREATE TYPE "TenantModuleKey" AS ENUM ('GYM');
CREATE TYPE "TenantModuleStatus" AS ENUM ('ENABLED', 'DISABLED');

ALTER TABLE "SubscriptionPlan"
ADD COLUMN "planKind" "PlanKind" NOT NULL DEFAULT 'CLASS',
ALTER COLUMN "sportId" DROP NOT NULL;

ALTER TABLE "MemberSubscription"
ALTER COLUMN "sportId" DROP NOT NULL;

ALTER TABLE "ClubSettings"
ADD COLUMN "dashboardShowGymOverview" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "gymAllowCheckInWithPartialPayment" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "gymDuplicateScanWindowMinutes" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN "gymDailyVisitLimit" INTEGER,
ADD COLUMN "gymAllowExceptionalAccess" BOOLEAN NOT NULL DEFAULT true;

UPDATE "ClubSettings"
SET "gymAllowCheckInWithPartialPayment" = "allowCheckInWithPartialPayment";

CREATE TABLE "TenantModule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "moduleKey" "TenantModuleKey" NOT NULL,
  "status" "TenantModuleStatus" NOT NULL DEFAULT 'ENABLED',
  "enabledAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantModule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlanEntitlement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "planId" TEXT NOT NULL,
  "type" "EntitlementType" NOT NULL,
  "sportId" TEXT,
  "sessionsPerWeek" INTEGER,
  "grantedUnits" INTEGER,
  "gymAccessMode" "GymAccessMode",
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PlanEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionEntitlement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "memberSubscriptionId" TEXT NOT NULL,
  "planEntitlementId" TEXT,
  "type" "EntitlementType" NOT NULL,
  "sportId" TEXT,
  "sessionsPerWeek" INTEGER,
  "grantedUnits" INTEGER,
  "remainingUnits" INTEGER,
  "gymAccessMode" "GymAccessMode",
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionEntitlement_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Attendance" ADD COLUMN "subscriptionEntitlementId" TEXT;

CREATE TABLE "GymVisit" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "memberSubscriptionId" TEXT NOT NULL,
  "subscriptionEntitlementId" TEXT NOT NULL,
  "entryType" "GymVisitEntryType" NOT NULL DEFAULT 'CHECK_IN',
  "correctsVisitId" TEXT,
  "unitsDelta" INTEGER NOT NULL DEFAULT 0,
  "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "checkedById" TEXT,
  "overrideReason" TEXT,
  "correctionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GymVisit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantModule_tenantId_moduleKey_key" ON "TenantModule"("tenantId", "moduleKey");
CREATE INDEX "TenantModule_tenantId_status_idx" ON "TenantModule"("tenantId", "status");
CREATE INDEX "PlanEntitlement_tenantId_idx" ON "PlanEntitlement"("tenantId");
CREATE INDEX "PlanEntitlement_planId_idx" ON "PlanEntitlement"("planId");
CREATE INDEX "PlanEntitlement_sportId_idx" ON "PlanEntitlement"("sportId");
CREATE INDEX "SubscriptionEntitlement_tenantId_idx" ON "SubscriptionEntitlement"("tenantId");
CREATE INDEX "SubscriptionEntitlement_memberSubscriptionId_idx" ON "SubscriptionEntitlement"("memberSubscriptionId");
CREATE INDEX "SubscriptionEntitlement_planEntitlementId_idx" ON "SubscriptionEntitlement"("planEntitlementId");
CREATE INDEX "SubscriptionEntitlement_sportId_type_idx" ON "SubscriptionEntitlement"("sportId", "type");
CREATE INDEX "Attendance_subscriptionEntitlementId_idx" ON "Attendance"("subscriptionEntitlementId");
CREATE INDEX "GymVisit_tenantId_checkedAt_idx" ON "GymVisit"("tenantId", "checkedAt");
CREATE INDEX "GymVisit_memberId_checkedAt_idx" ON "GymVisit"("memberId", "checkedAt");
CREATE INDEX "GymVisit_subscriptionEntitlementId_idx" ON "GymVisit"("subscriptionEntitlementId");
CREATE INDEX "GymVisit_correctsVisitId_idx" ON "GymVisit"("correctsVisitId");

ALTER TABLE "TenantModule" ADD CONSTRAINT "TenantModule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlanEntitlement" ADD CONSTRAINT "PlanEntitlement_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEntitlement" ADD CONSTRAINT "SubscriptionEntitlement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEntitlement" ADD CONSTRAINT "SubscriptionEntitlement_memberSubscriptionId_fkey" FOREIGN KEY ("memberSubscriptionId") REFERENCES "MemberSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEntitlement" ADD CONSTRAINT "SubscriptionEntitlement_planEntitlementId_fkey" FOREIGN KEY ("planEntitlementId") REFERENCES "PlanEntitlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubscriptionEntitlement" ADD CONSTRAINT "SubscriptionEntitlement_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_subscriptionEntitlementId_fkey" FOREIGN KEY ("subscriptionEntitlementId") REFERENCES "SubscriptionEntitlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GymVisit" ADD CONSTRAINT "GymVisit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GymVisit" ADD CONSTRAINT "GymVisit_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GymVisit" ADD CONSTRAINT "GymVisit_memberSubscriptionId_fkey" FOREIGN KEY ("memberSubscriptionId") REFERENCES "MemberSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GymVisit" ADD CONSTRAINT "GymVisit_subscriptionEntitlementId_fkey" FOREIGN KEY ("subscriptionEntitlementId") REFERENCES "SubscriptionEntitlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GymVisit" ADD CONSTRAINT "GymVisit_correctsVisitId_fkey" FOREIGN KEY ("correctsVisitId") REFERENCES "GymVisit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GymVisit" ADD CONSTRAINT "GymVisit_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "PlanEntitlement" (
  "id", "tenantId", "planId", "type", "sportId", "sessionsPerWeek", "grantedUnits", "sortOrder", "createdAt", "updatedAt"
)
SELECT
  'legacy-plan-entitlement-' || p."id",
  p."tenantId",
  p."id",
  'CLASS_SESSIONS'::"EntitlementType",
  p."sportId",
  p."sessionsPerWeek",
  p."totalSessions",
  0,
  p."createdAt",
  CURRENT_TIMESTAMP
FROM "SubscriptionPlan" p;

INSERT INTO "SubscriptionEntitlement" (
  "id", "tenantId", "memberSubscriptionId", "planEntitlementId", "type", "sportId",
  "sessionsPerWeek", "grantedUnits", "remainingUnits", "startDate", "endDate", "createdAt", "updatedAt"
)
SELECT
  'legacy-subscription-entitlement-' || s."id",
  s."tenantId",
  s."id",
  'legacy-plan-entitlement-' || s."planId",
  'CLASS_SESSIONS'::"EntitlementType",
  s."sportId",
  p."sessionsPerWeek",
  p."totalSessions",
  s."remainingSessions",
  s."startDate",
  s."endDate",
  s."createdAt",
  CURRENT_TIMESTAMP
FROM "MemberSubscription" s
JOIN "SubscriptionPlan" p ON p."id" = s."planId";

UPDATE "Attendance" a
SET "subscriptionEntitlementId" = 'legacy-subscription-entitlement-' || a."memberSubscriptionId"
WHERE a."memberSubscriptionId" IS NOT NULL;
