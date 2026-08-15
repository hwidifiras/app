CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyRecord_tenantId_scope_key_key"
ON "IdempotencyRecord"("tenantId", "scope", "key");

CREATE INDEX "IdempotencyRecord_tenantId_idx" ON "IdempotencyRecord"("tenantId");
CREATE INDEX "IdempotencyRecord_tenantId_expiresAt_idx" ON "IdempotencyRecord"("tenantId", "expiresAt");
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");

ALTER TABLE "IdempotencyRecord"
ADD CONSTRAINT "IdempotencyRecord_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TRIGGER "idempotencyrecord_tenant_immutable"
BEFORE UPDATE OF "tenantId" ON "IdempotencyRecord"
FOR EACH ROW EXECUTE FUNCTION prevent_tenant_reassignment();
