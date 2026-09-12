ALTER TABLE "ClubSettings"
ADD COLUMN "annualInsuranceFeeCents" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "MemberSubscription"
ADD COLUMN "insuranceFeeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "insuranceYear" INTEGER;

CREATE UNIQUE INDEX "MemberSubscription_tenantId_memberId_insuranceYear_key"
ON "MemberSubscription"("tenantId", "memberId", "insuranceYear");
