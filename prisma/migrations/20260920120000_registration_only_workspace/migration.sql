ALTER TABLE "ClubSettings"
ADD COLUMN "registrationOnly" BOOLEAN NOT NULL DEFAULT false;

-- Allingym is the first focused-registration client. Other workspaces keep the full UI.
INSERT INTO "ClubSettings" ("id", "tenantId", "clubName", "registrationOnly", "updatedAt")
SELECT 'registration-only-' || tenant."id", tenant."id", tenant."name", true, CURRENT_TIMESTAMP
FROM "Tenant" AS tenant
WHERE REGEXP_REPLACE(LOWER(tenant."slug"), '[^a-z0-9]', '', 'g') = 'allingym'
   OR REGEXP_REPLACE(LOWER(tenant."name"), '[^a-z0-9]', '', 'g') = 'allingym'
   OR EXISTS (
     SELECT 1
     FROM "ClubSettings" AS current_settings
     WHERE current_settings."tenantId" = tenant."id"
       AND REGEXP_REPLACE(LOWER(current_settings."clubName"), '[^a-z0-9]', '', 'g') = 'allingym'
   )
ON CONFLICT ("tenantId") DO UPDATE
SET "registrationOnly" = EXCLUDED."registrationOnly";
