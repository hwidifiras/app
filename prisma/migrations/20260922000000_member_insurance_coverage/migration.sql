CREATE TYPE "InsuranceCoverageSource" AS ENUM ('HISTORICAL', 'SUBSCRIPTION');
CREATE TYPE "InsuranceCoverageStatus" AS ENUM ('ACTIVE', 'VOIDED');

CREATE TABLE "MemberInsuranceCoverage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "coverageStart" TIMESTAMP(3) NOT NULL,
    "coverageEnd" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "source" "InsuranceCoverageSource" NOT NULL,
    "status" "InsuranceCoverageStatus" NOT NULL DEFAULT 'ACTIVE',
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MemberInsuranceCoverage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MemberInsuranceCoverage_subscriptionId_key"
ON "MemberInsuranceCoverage"("subscriptionId");

CREATE INDEX "MemberInsuranceCoverage_tenantId_memberId_status_coverageStart_coverageEnd_idx"
ON "MemberInsuranceCoverage"("tenantId", "memberId", "status", "coverageStart", "coverageEnd");

CREATE INDEX "MemberInsuranceCoverage_tenantId_subscriptionId_idx"
ON "MemberInsuranceCoverage"("tenantId", "subscriptionId");

ALTER TABLE "MemberInsuranceCoverage"
ADD CONSTRAINT "MemberInsuranceCoverage_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemberInsuranceCoverage"
ADD CONSTRAINT "MemberInsuranceCoverage_memberId_fkey"
FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemberInsuranceCoverage"
ADD CONSTRAINT "MemberInsuranceCoverage_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "MemberSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "MemberInsuranceCoverage" (
    "id",
    "tenantId",
    "memberId",
    "subscriptionId",
    "coverageStart",
    "coverageEnd",
    "amountCents",
    "source",
    "status",
    "voidedAt",
    "voidReason",
    "createdAt",
    "updatedAt"
)
SELECT
    'insurance-' || subscription."id",
    subscription."tenantId",
    subscription."memberId",
    subscription."id",
    COALESCE(subscription."insuranceCoverageDate", subscription."startDate"),
    COALESCE(subscription."insuranceCoverageDate", subscription."startDate") + INTERVAL '1 year',
    subscription."insuranceFeeCents",
    CASE
      WHEN subscription."insuranceFeeCents" > 0
        THEN 'SUBSCRIPTION'::"InsuranceCoverageSource"
      ELSE 'HISTORICAL'::"InsuranceCoverageSource"
    END,
    CASE
      WHEN subscription."status" = 'CANCELLED' AND subscription."insuranceFeeCents" > 0
        THEN 'VOIDED'::"InsuranceCoverageStatus"
      ELSE 'ACTIVE'::"InsuranceCoverageStatus"
    END,
    CASE
      WHEN subscription."status" = 'CANCELLED' AND subscription."insuranceFeeCents" > 0
        THEN COALESCE(subscription."updatedAt", CURRENT_TIMESTAMP)
      ELSE NULL
    END,
    CASE
      WHEN subscription."status" = 'CANCELLED' AND subscription."insuranceFeeCents" > 0
        THEN 'Abonnement historique annulé'
      ELSE NULL
    END,
    subscription."createdAt",
    CURRENT_TIMESTAMP
FROM "MemberSubscription" AS subscription
WHERE subscription."tenantId" IS NOT NULL
  AND (subscription."insuranceCoverageDate" IS NOT NULL OR subscription."insuranceFeeCents" > 0)
ON CONFLICT ("subscriptionId") DO NOTHING;

-- Repair subscriptions created through the legacy member-registration route,
-- which stored the charge but omitted its coverage date.
UPDATE "MemberSubscription"
SET "insuranceCoverageDate" = "startDate"
WHERE "insuranceFeeCents" > 0
  AND "insuranceCoverageDate" IS NULL
  AND "status" <> 'CANCELLED';

-- A reverted charged enrollment must not keep blocking a corrected insurance
-- entry in the same calendar year. The member-level row above keeps the audit.
UPDATE "MemberSubscription"
SET "insuranceYear" = NULL,
    "insuranceCoverageDate" = NULL
WHERE "status" = 'CANCELLED'
  AND "insuranceFeeCents" > 0;
