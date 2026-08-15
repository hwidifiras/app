CREATE TYPE "TenantModuleKey_new" AS ENUM ('CLASS_MANAGEMENT', 'GYM_ACCESS');

ALTER TABLE "TenantModule"
ALTER COLUMN "moduleKey" TYPE "TenantModuleKey_new"
USING (
  CASE "moduleKey"::TEXT
    WHEN 'GYM' THEN 'GYM_ACCESS'
    ELSE "moduleKey"::TEXT
  END
)::"TenantModuleKey_new";

DROP TYPE "TenantModuleKey";
ALTER TYPE "TenantModuleKey_new" RENAME TO "TenantModuleKey";

INSERT INTO "TenantModule" (
  "id",
  "tenantId",
  "moduleKey",
  "status",
  "enabledAt",
  "disabledAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'tm_class_' || md5(tenant."id"),
  tenant."id",
  'CLASS_MANAGEMENT'::"TenantModuleKey",
  'ENABLED'::"TenantModuleStatus",
  CURRENT_TIMESTAMP,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Tenant" tenant
ON CONFLICT ("tenantId", "moduleKey") DO UPDATE
SET
  "status" = 'ENABLED'::"TenantModuleStatus",
  "enabledAt" = COALESCE("TenantModule"."enabledAt", CURRENT_TIMESTAMP),
  "disabledAt" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "TenantModule" module
SET
  "status" = 'DISABLED'::"TenantModuleStatus",
  "disabledAt" = COALESCE(module."disabledAt", CURRENT_TIMESTAMP),
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Tenant" tenant
WHERE tenant."id" = module."tenantId"
  AND tenant."slug" = 'we-discipline'
  AND module."moduleKey" = 'GYM_ACCESS'::"TenantModuleKey";
