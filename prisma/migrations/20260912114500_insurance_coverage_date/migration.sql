ALTER TABLE "MemberSubscription"
ADD COLUMN "insuranceCoverageDate" TIMESTAMP(3);

UPDATE "MemberSubscription"
SET "insuranceCoverageDate" = "startDate"
WHERE "insuranceFeeCents" > 0;

CREATE INDEX "MemberSubscription_tenantId_memberId_insuranceCoverageDate_idx"
ON "MemberSubscription"("tenantId", "memberId", "insuranceCoverageDate");
