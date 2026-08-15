-- Add revocable gym credentials, auditable denied/exceptional access attempts,
-- and tenant-configurable opening windows. Existing access behavior stays open
-- until a tenant explicitly enables opening-hours enforcement.

CREATE TYPE "GymAccessAttemptOutcome" AS ENUM ('DENIED', 'EXCEPTIONAL_ALLOWED');

ALTER TABLE "ClubSettings"
  ADD COLUMN "gymEnforceOpeningHours" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "gymOpeningHours" JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE "MemberAccessCredential" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "codeHint" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "issuedById" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "revokeReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MemberAccessCredential_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MemberAccessCredential_code_hint_check" CHECK (length(btrim("codeHint")) BETWEEN 4 AND 16),
  CONSTRAINT "MemberAccessCredential_revocation_check" CHECK (
    ("revokedAt" IS NULL AND "revokeReason" IS NULL)
    OR
    ("revokedAt" IS NOT NULL AND length(btrim("revokeReason")) >= 3)
  )
);

CREATE UNIQUE INDEX "MemberAccessCredential_one_active_per_member_key"
  ON "MemberAccessCredential"("tenantId", "memberId")
  WHERE "revokedAt" IS NULL;
CREATE INDEX "MemberAccessCredential_tenantId_memberId_revokedAt_idx"
  ON "MemberAccessCredential"("tenantId", "memberId", "revokedAt");
CREATE INDEX "MemberAccessCredential_tenantId_issuedAt_idx"
  ON "MemberAccessCredential"("tenantId", "issuedAt");

ALTER TABLE "MemberAccessCredential"
  ADD CONSTRAINT "MemberAccessCredential_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MemberAccessCredential_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MemberAccessCredential_issuedById_fkey"
    FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "MemberAccessCredential_revokedById_fkey"
    FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "GymAccessAttempt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "memberId" TEXT,
  "credentialId" TEXT,
  "outcome" "GymAccessAttemptOutcome" NOT NULL,
  "failureCode" TEXT,
  "identifierFingerprint" TEXT,
  "overrideReason" TEXT,
  "checkedById" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GymAccessAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GymAccessAttempt_shape_check" CHECK (
    (
      "outcome" = 'DENIED'
      AND "failureCode" IS NOT NULL
      AND length(btrim("failureCode")) >= 3
    )
    OR
    (
      "outcome" = 'EXCEPTIONAL_ALLOWED'
      AND "memberId" IS NOT NULL
      AND "overrideReason" IS NOT NULL
      AND length(btrim("overrideReason")) >= 3
    )
  ),
  CONSTRAINT "GymAccessAttempt_fingerprint_check" CHECK (
    "identifierFingerprint" IS NULL OR length("identifierFingerprint") BETWEEN 12 AND 64
  )
);

CREATE INDEX "GymAccessAttempt_tenantId_occurredAt_idx"
  ON "GymAccessAttempt"("tenantId", "occurredAt");
CREATE INDEX "GymAccessAttempt_tenantId_outcome_occurredAt_idx"
  ON "GymAccessAttempt"("tenantId", "outcome", "occurredAt");
CREATE INDEX "GymAccessAttempt_tenantId_memberId_occurredAt_idx"
  ON "GymAccessAttempt"("tenantId", "memberId", "occurredAt");
CREATE INDEX "GymAccessAttempt_credentialId_idx" ON "GymAccessAttempt"("credentialId");

ALTER TABLE "GymAccessAttempt"
  ADD CONSTRAINT "GymAccessAttempt_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GymAccessAttempt_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "GymAccessAttempt_credentialId_fkey"
    FOREIGN KEY ("credentialId") REFERENCES "MemberAccessCredential"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "GymAccessAttempt_checkedById_fkey"
    FOREIGN KEY ("checkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MemberAccessCredential"
  ADD CONSTRAINT "MemberAccessCredential_tenantId_required" CHECK ("tenantId" IS NOT NULL);
ALTER TABLE "GymAccessAttempt"
  ADD CONSTRAINT "GymAccessAttempt_tenantId_required" CHECK ("tenantId" IS NOT NULL);

CREATE TRIGGER memberaccesscredential_tenant_reassignment_guard
BEFORE UPDATE OF "tenantId" ON "MemberAccessCredential"
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_reassignment();

CREATE TRIGGER gymaccessattempt_tenant_reassignment_guard
BEFORE UPDATE OF "tenantId" ON "GymAccessAttempt"
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_reassignment();

CREATE TRIGGER memberaccesscredential_memberid_tenant_guard
BEFORE INSERT OR UPDATE OF "tenantId", "memberId" ON "MemberAccessCredential"
FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference('Member', 'memberId');

CREATE TRIGGER memberaccesscredential_issuedbyid_tenant_guard
BEFORE INSERT OR UPDATE OF "tenantId", "issuedById" ON "MemberAccessCredential"
FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference('User', 'issuedById');

CREATE TRIGGER memberaccesscredential_revokedbyid_tenant_guard
BEFORE INSERT OR UPDATE OF "tenantId", "revokedById" ON "MemberAccessCredential"
FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference('User', 'revokedById');

CREATE TRIGGER gymaccessattempt_memberid_tenant_guard
BEFORE INSERT OR UPDATE OF "tenantId", "memberId" ON "GymAccessAttempt"
FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference('Member', 'memberId');

CREATE TRIGGER gymaccessattempt_credentialid_tenant_guard
BEFORE INSERT OR UPDATE OF "tenantId", "credentialId" ON "GymAccessAttempt"
FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference('MemberAccessCredential', 'credentialId');

CREATE TRIGGER gymaccessattempt_checkedbyid_tenant_guard
BEFORE INSERT OR UPDATE OF "tenantId", "checkedById" ON "GymAccessAttempt"
FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference('User', 'checkedById');

CREATE OR REPLACE FUNCTION enforce_gym_attempt_credential_member()
RETURNS TRIGGER AS $$
DECLARE
  credential_member_id TEXT;
BEGIN
  IF NEW."credentialId" IS NULL OR NEW."memberId" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT "memberId" INTO credential_member_id
  FROM "MemberAccessCredential"
  WHERE "id" = NEW."credentialId";
  IF credential_member_id IS DISTINCT FROM NEW."memberId" THEN
    RAISE EXCEPTION 'GYM_ATTEMPT_CREDENTIAL_MEMBER_MISMATCH';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gymaccessattempt_credential_member_guard
BEFORE INSERT OR UPDATE OF "memberId", "credentialId" ON "GymAccessAttempt"
FOR EACH ROW EXECUTE FUNCTION enforce_gym_attempt_credential_member();
