-- Link coach-facing accounts to one tenant-owned coach and backfill the finer
-- permission vocabulary without removing legacy keys during rollout.

ALTER TABLE "User" ADD COLUMN "coachId" TEXT;

CREATE UNIQUE INDEX "User_coachId_key" ON "User"("coachId");

ALTER TABLE "User"
  ADD CONSTRAINT "User_coachId_fkey"
  FOREIGN KEY ("coachId") REFERENCES "Coach"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TRIGGER user_coachid_tenant_guard
BEFORE INSERT OR UPDATE OF "tenantId", "coachId" ON "User"
FOR EACH ROW EXECUTE FUNCTION enforce_same_tenant_reference('Coach', 'coachId');

WITH permission_mapping("legacyKey", "permissionKey") AS (
  VALUES
    ('enrollment.manage', 'enrollment.sell'),
    ('attendance.manage', 'class.attendance'),
    ('payments.manage', 'payments.collect'),
    ('payments.manage', 'payments.correct'),
    ('payments.manage', 'reports.finance'),
    ('catalog.manage', 'class.manage'),
    ('catalog.manage', 'plans.manage'),
    ('catalog.manage', 'subscriptions.correct'),
    ('offers.manage', 'plans.manage'),
    ('gym.manage', 'gym.correct')
)
INSERT INTO "UserPermission" ("id", "tenantId", "userId", "key", "createdAt")
SELECT
  'perm_' || md5(source."tenantId" || ':' || source."userId" || ':' || mapping."permissionKey"),
  source."tenantId",
  source."userId",
  mapping."permissionKey",
  CURRENT_TIMESTAMP
FROM "UserPermission" source
JOIN permission_mapping mapping ON mapping."legacyKey" = source."key"
WHERE source."tenantId" IS NOT NULL
ON CONFLICT ("tenantId", "userId", "key") DO NOTHING;
