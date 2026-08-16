CREATE TYPE "WorkspaceSignupStatus" AS ENUM (
  'PENDING_EMAIL',
  'VERIFIED',
  'PROVISIONING',
  'COMPLETED',
  'EXPIRED',
  'FAILED'
);

CREATE TYPE "WorkspaceEdition" AS ENUM ('CLASS', 'GYM', 'HYBRID');
CREATE TYPE "TenantOnboardingStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');
CREATE TYPE "TenantOnboardingSource" AS ENUM ('SELF_SERVE', 'MANUAL');
CREATE TYPE "AccessCredentialMedium" AS ENUM (
  'QR_CODE',
  'BARCODE',
  'NFC_TAG',
  'RFID_CARD',
  'RFID_WRISTBAND'
);

ALTER TABLE "MemberAccessCredential"
  ADD COLUMN "medium" "AccessCredentialMedium" NOT NULL DEFAULT 'QR_CODE',
  ADD COLUMN "label" TEXT,
  ADD COLUMN "externalIdentifierHash" TEXT,
  ADD COLUMN "externalIdentifierHint" TEXT;

CREATE INDEX "MemberAccessCredential_tenantId_medium_revokedAt_idx"
  ON "MemberAccessCredential"("tenantId", "medium", "revokedAt");
CREATE INDEX "MemberAccessCredential_tenantId_externalIdentifierHash_idx"
  ON "MemberAccessCredential"("tenantId", "externalIdentifierHash");
CREATE UNIQUE INDEX "MemberAccessCredential_one_active_external_identifier_key"
  ON "MemberAccessCredential"("tenantId", "externalIdentifierHash")
  WHERE "revokedAt" IS NULL AND "externalIdentifierHash" IS NOT NULL;

ALTER TABLE "MemberAccessCredential"
  ADD CONSTRAINT "MemberAccessCredential_external_identifier_check" CHECK (
    ("externalIdentifierHash" IS NULL AND "externalIdentifierHint" IS NULL)
    OR (
      "externalIdentifierHash" IS NOT NULL
      AND length("externalIdentifierHash") BETWEEN 32 AND 128
      AND ("externalIdentifierHint" IS NULL OR length(btrim("externalIdentifierHint")) BETWEEN 2 AND 32)
    )
  );

CREATE TABLE "WorkspaceSignupInvite" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "email" TEXT,
  "edition" "WorkspaceEdition",
  "activityTemplateKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "maxUses" INTEGER NOT NULL DEFAULT 1,
  "useCount" INTEGER NOT NULL DEFAULT 0,
  "revokedAt" TIMESTAMP(3),
  "operatorIdentity" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceSignupInvite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceSignupInvite_usage_check" CHECK (
    "maxUses" > 0 AND "useCount" >= 0 AND "useCount" <= "maxUses"
  ),
  CONSTRAINT "WorkspaceSignupInvite_email_normalized_check" CHECK (
    "email" IS NULL OR "email" = lower(btrim("email"))
  )
);

CREATE UNIQUE INDEX "WorkspaceSignupInvite_tokenHash_key" ON "WorkspaceSignupInvite"("tokenHash");
CREATE INDEX "WorkspaceSignupInvite_email_expiresAt_idx" ON "WorkspaceSignupInvite"("email", "expiresAt");
CREATE INDEX "WorkspaceSignupInvite_expiresAt_revokedAt_idx" ON "WorkspaceSignupInvite"("expiresAt", "revokedAt");

CREATE TABLE "WorkspaceSignup" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "clubName" TEXT,
  "clubPhone" TEXT NOT NULL DEFAULT '',
  "clubAddress" TEXT NOT NULL DEFAULT '',
  "requestedSlug" TEXT,
  "edition" "WorkspaceEdition",
  "activityTemplateKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "templateCatalogVersion" INTEGER NOT NULL DEFAULT 1,
  "status" "WorkspaceSignupStatus" NOT NULL DEFAULT 'PENDING_EMAIL',
  "termsVersion" TEXT NOT NULL,
  "privacyVersion" TEXT NOT NULL,
  "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
  "emailVerifiedAt" TIMESTAMP(3),
  "provisioningStartedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "failureCode" TEXT,
  "requestFingerprint" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "inviteId" TEXT,
  "tenantId" TEXT,
  "adminUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkspaceSignup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceSignup_email_normalized_check" CHECK ("email" = lower(btrim("email"))),
  CONSTRAINT "WorkspaceSignup_slug_check" CHECK (
    "requestedSlug" IS NULL OR "requestedSlug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  CONSTRAINT "WorkspaceSignup_catalog_version_check" CHECK ("templateCatalogVersion" > 0),
  CONSTRAINT "WorkspaceSignup_expiry_check" CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "WorkspaceSignup_completion_check" CHECK (
    "status" <> 'COMPLETED'
    OR ("tenantId" IS NOT NULL AND "adminUserId" IS NOT NULL AND "completedAt" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "WorkspaceSignup_idempotencyKey_key" ON "WorkspaceSignup"("idempotencyKey");
CREATE UNIQUE INDEX "WorkspaceSignup_tenantId_key" ON "WorkspaceSignup"("tenantId");
CREATE INDEX "WorkspaceSignup_email_status_idx" ON "WorkspaceSignup"("email", "status");
CREATE INDEX "WorkspaceSignup_requestedSlug_status_idx" ON "WorkspaceSignup"("requestedSlug", "status");
CREATE INDEX "WorkspaceSignup_expiresAt_status_idx" ON "WorkspaceSignup"("expiresAt", "status");
CREATE INDEX "WorkspaceSignup_inviteId_idx" ON "WorkspaceSignup"("inviteId");

CREATE TABLE "SignupVerificationToken" (
  "id" TEXT NOT NULL,
  "signupId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 6,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "invalidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SignupVerificationToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SignupVerificationToken_attempts_check" CHECK (
    "attemptCount" >= 0 AND "maxAttempts" > 0 AND "attemptCount" <= "maxAttempts"
  ),
  CONSTRAINT "SignupVerificationToken_expiry_check" CHECK ("expiresAt" > "createdAt")
);

CREATE UNIQUE INDEX "SignupVerificationToken_tokenHash_key" ON "SignupVerificationToken"("tokenHash");
CREATE INDEX "SignupVerificationToken_signupId_createdAt_idx" ON "SignupVerificationToken"("signupId", "createdAt");
CREATE INDEX "SignupVerificationToken_expiresAt_usedAt_idx" ON "SignupVerificationToken"("expiresAt", "usedAt");

CREATE TABLE "WorkspaceHandoffToken" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceHandoffToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceHandoffToken_expiry_check" CHECK ("expiresAt" > "createdAt")
);

CREATE UNIQUE INDEX "WorkspaceHandoffToken_tokenHash_key" ON "WorkspaceHandoffToken"("tokenHash");
CREATE INDEX "WorkspaceHandoffToken_tenantId_expiresAt_idx" ON "WorkspaceHandoffToken"("tenantId", "expiresAt");
CREATE INDEX "WorkspaceHandoffToken_userId_expiresAt_idx" ON "WorkspaceHandoffToken"("userId", "expiresAt");

CREATE TABLE "TenantOnboarding" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "source" "TenantOnboardingSource" NOT NULL DEFAULT 'MANUAL',
  "status" "TenantOnboardingStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "lastStepKey" TEXT,
  "acknowledgedStepKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "skippedOptionalStepKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "selectedTemplateKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "templateCatalogVersion" INTEGER NOT NULL DEFAULT 1,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantOnboarding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantOnboarding_version_check" CHECK (
    "version" > 0 AND "templateCatalogVersion" > 0
  ),
  CONSTRAINT "TenantOnboarding_completion_check" CHECK (
    ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL)
    OR ("status" = 'IN_PROGRESS' AND "completedAt" IS NULL)
  )
);

CREATE UNIQUE INDEX "TenantOnboarding_tenantId_key" ON "TenantOnboarding"("tenantId");
CREATE INDEX "TenantOnboarding_status_updatedAt_idx" ON "TenantOnboarding"("status", "updatedAt");

ALTER TABLE "WorkspaceSignup"
  ADD CONSTRAINT "WorkspaceSignup_inviteId_fkey"
    FOREIGN KEY ("inviteId") REFERENCES "WorkspaceSignupInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkspaceSignup_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkspaceSignup_adminUserId_fkey"
    FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SignupVerificationToken"
  ADD CONSTRAINT "SignupVerificationToken_signupId_fkey"
    FOREIGN KEY ("signupId") REFERENCES "WorkspaceSignup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceHandoffToken"
  ADD CONSTRAINT "WorkspaceHandoffToken_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "WorkspaceHandoffToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantOnboarding"
  ADD CONSTRAINT "TenantOnboarding_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER "WorkspaceHandoffToken_tenant_immutable"
BEFORE UPDATE OF "tenantId" ON "WorkspaceHandoffToken"
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_reassignment();

CREATE TRIGGER "TenantOnboarding_tenant_immutable"
BEFORE UPDATE OF "tenantId" ON "TenantOnboarding"
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_reassignment();

CREATE TRIGGER "WorkspaceSignup_admin_same_tenant"
BEFORE INSERT OR UPDATE OF "tenantId", "adminUserId" ON "WorkspaceSignup"
FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference('User', 'adminUserId');

CREATE TRIGGER "WorkspaceHandoffToken_user_same_tenant"
BEFORE INSERT OR UPDATE OF "tenantId", "userId" ON "WorkspaceHandoffToken"
FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference('User', 'userId');
