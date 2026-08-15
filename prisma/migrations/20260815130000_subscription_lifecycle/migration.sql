-- Add lifecycle snapshots and append-only pause/entitlement ledgers without
-- changing any existing subscription date, balance, payment, or status.

CREATE TYPE "PlanActivationPolicy" AS ENUM ('FIXED_DATE', 'FIRST_USE');
CREATE TYPE "SubscriptionPauseEntryType" AS ENUM ('PAUSE', 'RESUME');
CREATE TYPE "EntitlementAdjustmentKind" AS ENUM ('UNITS', 'EXPIRY', 'ACTIVATION', 'REPLACEMENT');

ALTER TABLE "SubscriptionPlan"
  ADD COLUMN "activationPolicy" "PlanActivationPolicy" NOT NULL DEFAULT 'FIXED_DATE',
  ADD COLUMN "activationWindowDays" INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN "freezeAllowanceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "freezeMaxTotalDays" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SubscriptionPlan"
  ADD CONSTRAINT "SubscriptionPlan_activation_policy_kind_check"
    CHECK ("activationPolicy" <> 'FIRST_USE' OR "planKind" = 'GYM'),
  ADD CONSTRAINT "SubscriptionPlan_activation_window_check"
    CHECK ("activationWindowDays" BETWEEN 1 AND 3650),
  ADD CONSTRAINT "SubscriptionPlan_freeze_limits_check"
    CHECK ("freezeAllowanceCount" >= 0 AND "freezeMaxTotalDays" >= 0);

ALTER TABLE "MemberSubscription"
  ADD COLUMN "activationPolicy" "PlanActivationPolicy" NOT NULL DEFAULT 'FIXED_DATE',
  ADD COLUMN "activationWindowDays" INTEGER,
  ADD COLUMN "activationDeadline" TIMESTAMP(3),
  ADD COLUMN "activatedAt" TIMESTAMP(3),
  ADD COLUMN "freezeAllowanceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "freezeMaxTotalDays" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "renewsSubscriptionId" TEXT,
  ADD COLUMN "replacesSubscriptionId" TEXT;

UPDATE "MemberSubscription" subscription
SET
  "activationPolicy" = plan."activationPolicy",
  "activationWindowDays" = plan."activationWindowDays",
  "activatedAt" = subscription."startDate",
  "freezeAllowanceCount" = plan."freezeAllowanceCount",
  "freezeMaxTotalDays" = plan."freezeMaxTotalDays"
FROM "SubscriptionPlan" plan
WHERE plan."id" = subscription."planId";

ALTER TABLE "MemberSubscription"
  ADD CONSTRAINT "MemberSubscription_activation_window_check"
    CHECK ("activationWindowDays" IS NULL OR "activationWindowDays" BETWEEN 1 AND 3650),
  ADD CONSTRAINT "MemberSubscription_freeze_limits_check"
    CHECK ("freezeAllowanceCount" >= 0 AND "freezeMaxTotalDays" >= 0),
  ADD CONSTRAINT "MemberSubscription_renewal_not_self_check"
    CHECK ("renewsSubscriptionId" IS NULL OR "renewsSubscriptionId" <> "id"),
  ADD CONSTRAINT "MemberSubscription_replacement_not_self_check"
    CHECK ("replacesSubscriptionId" IS NULL OR "replacesSubscriptionId" <> "id");

CREATE UNIQUE INDEX "MemberSubscription_renewsSubscriptionId_key"
  ON "MemberSubscription"("renewsSubscriptionId");
CREATE UNIQUE INDEX "MemberSubscription_replacesSubscriptionId_key"
  ON "MemberSubscription"("replacesSubscriptionId");
CREATE INDEX "MemberSubscription_tenantId_memberId_activationDeadline_idx"
  ON "MemberSubscription"("tenantId", "memberId", "activationDeadline");

ALTER TABLE "MemberSubscription"
  ADD CONSTRAINT "MemberSubscription_renewsSubscriptionId_fkey"
    FOREIGN KEY ("renewsSubscriptionId") REFERENCES "MemberSubscription"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MemberSubscription_replacesSubscriptionId_fkey"
    FOREIGN KEY ("replacesSubscriptionId") REFERENCES "MemberSubscription"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SubscriptionPause" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "memberSubscriptionId" TEXT NOT NULL,
  "entryType" "SubscriptionPauseEntryType" NOT NULL,
  "pauseEventId" TEXT,
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "durationSeconds" INTEGER,
  "reason" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubscriptionPause_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubscriptionPause_event_shape_check" CHECK (
    ("entryType" = 'PAUSE' AND "pauseEventId" IS NULL AND "durationSeconds" IS NULL)
    OR
    ("entryType" = 'RESUME' AND "pauseEventId" IS NOT NULL AND "durationSeconds" IS NOT NULL AND "durationSeconds" >= 0)
  ),
  CONSTRAINT "SubscriptionPause_reason_check" CHECK (length(btrim("reason")) >= 3)
);

CREATE UNIQUE INDEX "SubscriptionPause_pauseEventId_key" ON "SubscriptionPause"("pauseEventId");
CREATE INDEX "SubscriptionPause_tenantId_memberSubscriptionId_effectiveAt_idx"
  ON "SubscriptionPause"("tenantId", "memberSubscriptionId", "effectiveAt");
CREATE INDEX "SubscriptionPause_tenantId_entryType_effectiveAt_idx"
  ON "SubscriptionPause"("tenantId", "entryType", "effectiveAt");

ALTER TABLE "SubscriptionPause"
  ADD CONSTRAINT "SubscriptionPause_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "SubscriptionPause_memberSubscriptionId_fkey"
    FOREIGN KEY ("memberSubscriptionId") REFERENCES "MemberSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SubscriptionPause_pauseEventId_fkey"
    FOREIGN KEY ("pauseEventId") REFERENCES "SubscriptionPause"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "SubscriptionPause_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EntitlementAdjustment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "memberSubscriptionId" TEXT NOT NULL,
  "subscriptionEntitlementId" TEXT NOT NULL,
  "kind" "EntitlementAdjustmentKind" NOT NULL,
  "unitsDelta" INTEGER NOT NULL DEFAULT 0,
  "endDateDeltaSeconds" INTEGER NOT NULL DEFAULT 0,
  "previousRemainingUnits" INTEGER,
  "nextRemainingUnits" INTEGER,
  "previousStartDate" TIMESTAMP(3),
  "nextStartDate" TIMESTAMP(3),
  "previousEndDate" TIMESTAMP(3),
  "nextEndDate" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntitlementAdjustment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EntitlementAdjustment_reason_check" CHECK (length(btrim("reason")) >= 3),
  CONSTRAINT "EntitlementAdjustment_remaining_units_check" CHECK (
    "previousRemainingUnits" IS NULL OR "previousRemainingUnits" >= 0
  ),
  CONSTRAINT "EntitlementAdjustment_next_remaining_units_check" CHECK (
    "nextRemainingUnits" IS NULL OR "nextRemainingUnits" >= 0
  )
);

CREATE INDEX "EntitlementAdjustment_tenantId_memberSubscriptionId_createdAt_idx"
  ON "EntitlementAdjustment"("tenantId", "memberSubscriptionId", "createdAt");
CREATE INDEX "EntitlementAdjustment_tenantId_subscriptionEntitlementId_createdAt_idx"
  ON "EntitlementAdjustment"("tenantId", "subscriptionEntitlementId", "createdAt");

ALTER TABLE "EntitlementAdjustment"
  ADD CONSTRAINT "EntitlementAdjustment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EntitlementAdjustment_memberSubscriptionId_fkey"
    FOREIGN KEY ("memberSubscriptionId") REFERENCES "MemberSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EntitlementAdjustment_subscriptionEntitlementId_fkey"
    FOREIGN KEY ("subscriptionEntitlementId") REFERENCES "SubscriptionEntitlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EntitlementAdjustment_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SubscriptionPause"
  ADD CONSTRAINT "SubscriptionPause_tenantId_required" CHECK ("tenantId" IS NOT NULL);
ALTER TABLE "EntitlementAdjustment"
  ADD CONSTRAINT "EntitlementAdjustment_tenantId_required" CHECK ("tenantId" IS NOT NULL);

CREATE TRIGGER subscriptionpause_tenant_reassignment_guard
BEFORE UPDATE OF "tenantId" ON "SubscriptionPause"
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_reassignment();

CREATE TRIGGER entitlementadjustment_tenant_reassignment_guard
BEFORE UPDATE OF "tenantId" ON "EntitlementAdjustment"
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_reassignment();

CREATE TRIGGER membersubscription_renewssubscriptionid_tenant_guard
BEFORE INSERT OR UPDATE OF "tenantId", "renewsSubscriptionId" ON "MemberSubscription"
FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference('MemberSubscription', 'renewsSubscriptionId');

CREATE TRIGGER membersubscription_replacessubscriptionid_tenant_guard
BEFORE INSERT OR UPDATE OF "tenantId", "replacesSubscriptionId" ON "MemberSubscription"
FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference('MemberSubscription', 'replacesSubscriptionId');

CREATE TRIGGER subscriptionpause_membersubscriptionid_tenant_guard
BEFORE INSERT OR UPDATE OF "tenantId", "memberSubscriptionId" ON "SubscriptionPause"
FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference('MemberSubscription', 'memberSubscriptionId');

CREATE TRIGGER subscriptionpause_pauseeventid_tenant_guard
BEFORE INSERT OR UPDATE OF "tenantId", "pauseEventId" ON "SubscriptionPause"
FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference('SubscriptionPause', 'pauseEventId');

CREATE TRIGGER subscriptionpause_createdbyid_tenant_guard
BEFORE INSERT OR UPDATE OF "tenantId", "createdById" ON "SubscriptionPause"
FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference('User', 'createdById');

CREATE TRIGGER entitlementadjustment_membersubscriptionid_tenant_guard
BEFORE INSERT OR UPDATE OF "tenantId", "memberSubscriptionId" ON "EntitlementAdjustment"
FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference('MemberSubscription', 'memberSubscriptionId');

CREATE TRIGGER entitlementadjustment_subscriptionentitlementid_tenant_guard
BEFORE INSERT OR UPDATE OF "tenantId", "subscriptionEntitlementId" ON "EntitlementAdjustment"
FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference('SubscriptionEntitlement', 'subscriptionEntitlementId');

CREATE TRIGGER entitlementadjustment_createdbyid_tenant_guard
BEFORE INSERT OR UPDATE OF "tenantId", "createdById" ON "EntitlementAdjustment"
FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference('User', 'createdById');

CREATE OR REPLACE FUNCTION enforce_subscription_lineage_member()
RETURNS TRIGGER AS $$
DECLARE
  target_member_id TEXT;
  reference_id TEXT;
BEGIN
  reference_id := CASE
    WHEN TG_ARGV[0] = 'renewal' THEN NEW."renewsSubscriptionId"
    ELSE NEW."replacesSubscriptionId"
  END;
  IF reference_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT "memberId" INTO target_member_id
  FROM "MemberSubscription"
  WHERE "id" = reference_id;
  IF target_member_id IS NOT NULL AND target_member_id <> NEW."memberId" THEN
    RAISE EXCEPTION 'SUBSCRIPTION_LINEAGE_MEMBER_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER membersubscription_renewal_member_guard
BEFORE INSERT OR UPDATE OF "memberId", "renewsSubscriptionId" ON "MemberSubscription"
FOR EACH ROW EXECUTE FUNCTION enforce_subscription_lineage_member('renewal');

CREATE TRIGGER membersubscription_replacement_member_guard
BEFORE INSERT OR UPDATE OF "memberId", "replacesSubscriptionId" ON "MemberSubscription"
FOR EACH ROW EXECUTE FUNCTION enforce_subscription_lineage_member('replacement');

CREATE OR REPLACE FUNCTION enforce_subscription_pause_resume_link()
RETURNS TRIGGER AS $$
DECLARE
  linked_tenant_id TEXT;
  linked_subscription_id TEXT;
  linked_entry_type "SubscriptionPauseEntryType";
BEGIN
  IF NEW."entryType" <> 'RESUME' THEN
    RETURN NEW;
  END IF;
  SELECT "tenantId", "memberSubscriptionId", "entryType"
    INTO linked_tenant_id, linked_subscription_id, linked_entry_type
  FROM "SubscriptionPause"
  WHERE "id" = NEW."pauseEventId";
  IF linked_entry_type IS DISTINCT FROM 'PAUSE'
    OR linked_tenant_id IS DISTINCT FROM NEW."tenantId"
    OR linked_subscription_id IS DISTINCT FROM NEW."memberSubscriptionId" THEN
    RAISE EXCEPTION 'SUBSCRIPTION_PAUSE_LINK_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subscriptionpause_resume_link_guard
BEFORE INSERT OR UPDATE OF "tenantId", "memberSubscriptionId", "entryType", "pauseEventId" ON "SubscriptionPause"
FOR EACH ROW EXECUTE FUNCTION enforce_subscription_pause_resume_link();

CREATE OR REPLACE FUNCTION enforce_entitlement_adjustment_subscription()
RETURNS TRIGGER AS $$
DECLARE
  linked_subscription_id TEXT;
BEGIN
  SELECT "memberSubscriptionId" INTO linked_subscription_id
  FROM "SubscriptionEntitlement"
  WHERE "id" = NEW."subscriptionEntitlementId";
  IF linked_subscription_id IS NOT NULL
    AND linked_subscription_id <> NEW."memberSubscriptionId" THEN
    RAISE EXCEPTION 'ENTITLEMENT_ADJUSTMENT_SUBSCRIPTION_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER entitlementadjustment_subscription_guard
BEFORE INSERT OR UPDATE OF "memberSubscriptionId", "subscriptionEntitlementId" ON "EntitlementAdjustment"
FOR EACH ROW EXECUTE FUNCTION enforce_entitlement_adjustment_subscription();
