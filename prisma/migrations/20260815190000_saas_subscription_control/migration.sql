-- Add manual SaaS commercial control without changing any existing tenant's
-- effective access. Existing module grants are classified as manual grants;
-- tenants without a subscription row retain legacy-active behavior in code.

CREATE TYPE "SaasSubscriptionStatus" AS ENUM (
  'TRIAL',
  'ACTIVE',
  'PAST_DUE',
  'GRACE',
  'SUSPENDED',
  'CANCELLED'
);

CREATE TYPE "TenantModuleGrantSource" AS ENUM ('MANUAL', 'SAAS_SUBSCRIPTION');

CREATE TABLE "SaasPlan" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "priceCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'TND',
  "billingPeriodMonths" INTEGER NOT NULL DEFAULT 1,
  "userLimit" INTEGER,
  "memberLimit" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SaasPlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SaasPlan_price_check" CHECK ("priceCents" IS NULL OR "priceCents" >= 0),
  CONSTRAINT "SaasPlan_billing_period_check" CHECK ("billingPeriodMonths" > 0),
  CONSTRAINT "SaasPlan_user_limit_check" CHECK ("userLimit" IS NULL OR "userLimit" > 0),
  CONSTRAINT "SaasPlan_member_limit_check" CHECK ("memberLimit" IS NULL OR "memberLimit" > 0),
  CONSTRAINT "SaasPlan_currency_check" CHECK (length(btrim("currency")) = 3)
);

CREATE UNIQUE INDEX "SaasPlan_code_key" ON "SaasPlan"("code");

CREATE TABLE "SaasPlanModule" (
  "id" TEXT NOT NULL,
  "saasPlanId" TEXT NOT NULL,
  "moduleKey" "TenantModuleKey" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SaasPlanModule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SaasPlanModule_saasPlanId_moduleKey_key"
  ON "SaasPlanModule"("saasPlanId", "moduleKey");
CREATE INDEX "SaasPlanModule_moduleKey_idx" ON "SaasPlanModule"("moduleKey");

CREATE TABLE "TenantSaasSubscription" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "saasPlanId" TEXT NOT NULL,
  "status" "SaasSubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "trialEndsAt" TIMESTAMP(3),
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "graceEndsAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "operatorNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantSaasSubscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantSaasSubscription_period_check" CHECK (
    "currentPeriodStart" IS NULL
    OR "currentPeriodEnd" IS NULL
    OR "currentPeriodEnd" >= "currentPeriodStart"
  ),
  CONSTRAINT "TenantSaasSubscription_trial_check" CHECK (
    "trialEndsAt" IS NULL OR "trialEndsAt" >= "startsAt"
  )
);

CREATE UNIQUE INDEX "TenantSaasSubscription_one_current_per_tenant_key"
  ON "TenantSaasSubscription"("tenantId")
  WHERE "isCurrent" = true;
CREATE INDEX "TenantSaasSubscription_tenantId_isCurrent_idx"
  ON "TenantSaasSubscription"("tenantId", "isCurrent");
CREATE INDEX "TenantSaasSubscription_tenantId_status_idx"
  ON "TenantSaasSubscription"("tenantId", "status");
CREATE INDEX "TenantSaasSubscription_saasPlanId_idx"
  ON "TenantSaasSubscription"("saasPlanId");

ALTER TABLE "TenantModule"
  ADD COLUMN "grantSource" "TenantModuleGrantSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "saasSubscriptionId" TEXT;

CREATE INDEX "TenantModule_saasSubscriptionId_idx"
  ON "TenantModule"("saasSubscriptionId");

ALTER TABLE "TenantModule"
  ADD CONSTRAINT "TenantModule_grant_source_check" CHECK (
    ("grantSource" = 'MANUAL' AND "saasSubscriptionId" IS NULL)
    OR
    ("grantSource" = 'SAAS_SUBSCRIPTION' AND "saasSubscriptionId" IS NOT NULL)
  );

CREATE TABLE "PlatformAuditLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "operatorIdentity" TEXT NOT NULL,
  "beforeState" JSONB,
  "afterState" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlatformAuditLog_operator_check" CHECK (length(btrim("operatorIdentity")) >= 3),
  CONSTRAINT "PlatformAuditLog_action_check" CHECK (length(btrim("action")) >= 3)
);

CREATE INDEX "PlatformAuditLog_tenantId_createdAt_idx"
  ON "PlatformAuditLog"("tenantId", "createdAt");
CREATE INDEX "PlatformAuditLog_entityType_entityId_createdAt_idx"
  ON "PlatformAuditLog"("entityType", "entityId", "createdAt");
CREATE INDEX "PlatformAuditLog_operatorIdentity_createdAt_idx"
  ON "PlatformAuditLog"("operatorIdentity", "createdAt");

ALTER TABLE "SaasPlanModule"
  ADD CONSTRAINT "SaasPlanModule_saasPlanId_fkey"
  FOREIGN KEY ("saasPlanId") REFERENCES "SaasPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantSaasSubscription"
  ADD CONSTRAINT "TenantSaasSubscription_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "TenantSaasSubscription_saasPlanId_fkey"
  FOREIGN KEY ("saasPlanId") REFERENCES "SaasPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TenantModule"
  ADD CONSTRAINT "TenantModule_saasSubscriptionId_fkey"
  FOREIGN KEY ("saasSubscriptionId") REFERENCES "TenantSaasSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER tenantsaassubscription_tenant_reassignment_guard
BEFORE UPDATE OF "tenantId" ON "TenantSaasSubscription"
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_reassignment();

CREATE TRIGGER tenantmodule_saassubscriptionid_tenant_guard
BEFORE INSERT OR UPDATE OF "tenantId", "saasSubscriptionId" ON "TenantModule"
FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference('TenantSaasSubscription', 'saasSubscriptionId');

CREATE OR REPLACE FUNCTION prevent_platform_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '23514',
    MESSAGE = format('PLATFORM_AUDIT_APPEND_ONLY: %s', OLD."id");
END;
$$;

CREATE TRIGGER platformauditlog_append_only_guard
BEFORE UPDATE OR DELETE ON "PlatformAuditLog"
FOR EACH ROW EXECUTE FUNCTION prevent_platform_audit_mutation();
