-- Composite indexes for tenant-scoped list pagination and dashboard read models.
-- These statements intentionally run outside a transaction so PostgreSQL can
-- keep the affected tables writable while each index is built.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Member_tenantId_status_createdAt_idx"
  ON "Member"("tenantId", status, "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Member_tenantId_createdAt_idx"
  ON "Member"("tenantId", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Group_tenantId_sportId_isActive_idx"
  ON "Group"("tenantId", "sportId", "isActive");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "GroupMember_tenantId_memberId_status_idx"
  ON "GroupMember"("tenantId", "memberId", status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Session_tenantId_sessionDate_status_idx"
  ON "Session"("tenantId", "sessionDate", status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "MemberSubscription_tenantId_status_createdAt_idx"
  ON "MemberSubscription"("tenantId", status, "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "MemberSubscription_tenantId_status_memberId_createdAt_idx"
  ON "MemberSubscription"("tenantId", status, "memberId", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Payment_tenantId_paymentDate_idx"
  ON "Payment"("tenantId", "paymentDate");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Payment_tenantId_memberSubscriptionId_idx"
  ON "Payment"("tenantId", "memberSubscriptionId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Receipt_tenantId_issuedAt_status_idx"
  ON "Receipt"("tenantId", "issuedAt", status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditLog_tenantId_createdAt_idx"
  ON "AuditLog"("tenantId", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AuditLog_tenantId_action_createdAt_idx"
  ON "AuditLog"("tenantId", action, "createdAt");
