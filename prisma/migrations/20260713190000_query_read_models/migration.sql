-- Composite indexes for tenant-scoped list pagination and dashboard read models.
-- Prisma deploys each migration transactionally, so these indexes deliberately
-- use regular CREATE INDEX statements. Production preflight validates the copied
-- database first, and the current dataset keeps the lock window bounded.
CREATE INDEX IF NOT EXISTS "Member_tenantId_status_createdAt_idx"
  ON "Member"("tenantId", status, "createdAt");

CREATE INDEX IF NOT EXISTS "Member_tenantId_createdAt_idx"
  ON "Member"("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "Group_tenantId_sportId_isActive_idx"
  ON "Group"("tenantId", "sportId", "isActive");

CREATE INDEX IF NOT EXISTS "GroupMember_tenantId_memberId_status_idx"
  ON "GroupMember"("tenantId", "memberId", status);

CREATE INDEX IF NOT EXISTS "Session_tenantId_sessionDate_status_idx"
  ON "Session"("tenantId", "sessionDate", status);

CREATE INDEX IF NOT EXISTS "MemberSubscription_tenantId_status_createdAt_idx"
  ON "MemberSubscription"("tenantId", status, "createdAt");

CREATE INDEX IF NOT EXISTS "MemberSubscription_tenantId_status_memberId_createdAt_idx"
  ON "MemberSubscription"("tenantId", status, "memberId", "createdAt");

CREATE INDEX IF NOT EXISTS "Payment_tenantId_paymentDate_idx"
  ON "Payment"("tenantId", "paymentDate");

CREATE INDEX IF NOT EXISTS "Payment_tenantId_memberSubscriptionId_idx"
  ON "Payment"("tenantId", "memberSubscriptionId");

CREATE INDEX IF NOT EXISTS "Receipt_tenantId_issuedAt_status_idx"
  ON "Receipt"("tenantId", "issuedAt", status);

CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_createdAt_idx"
  ON "AuditLog"("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_action_createdAt_idx"
  ON "AuditLog"("tenantId", action, "createdAt");
