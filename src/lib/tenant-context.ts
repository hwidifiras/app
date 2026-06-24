import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContext = {
  tenantId: string;
  tenantSlug: string;
  host?: string;
};

const tenantStorage = new AsyncLocalStorage<TenantContext>();
let fallbackTenantContext: TenantContext | null = null;

export const TENANT_SCOPED_MODELS = new Set([
  "User",
  "UserPermission",
  "PasswordResetToken",
  "NotificationRead",
  "ClubSettings",
  "Member",
  "Household",
  "HouseholdMember",
  "Sport",
  "Coach",
  "CoachSportQualification",
  "Group",
  "GroupMember",
  "GroupSchedule",
  "Session",
  "SubscriptionPlan",
  "MemberSubscription",
  "Payment",
  "Offer",
  "OfferApplication",
  "Attendance",
  "AuditLog",
]);

export function withTenantContext<T>(context: TenantContext, fn: () => T): T {
  return tenantStorage.run(context, fn);
}

export function enterTenantContext(context: TenantContext): void {
  tenantStorage.enterWith(context);
}

export function setFallbackTenantContext(context: TenantContext | null): void {
  fallbackTenantContext = context;
}

export function getTenantContext(): TenantContext | null {
  return tenantStorage.getStore() ?? fallbackTenantContext;
}

export function getRequiredTenantContext(): TenantContext {
  const context = getTenantContext();
  if (!context?.tenantId) {
    throw new Error("TENANT_CONTEXT_REQUIRED");
  }
  return context;
}

export function getTenantId(): string | null {
  return getTenantContext()?.tenantId ?? null;
}

export function getRequiredTenantId(): string {
  return getRequiredTenantContext().tenantId;
}

export function isTenantScopedModel(model: string | undefined): boolean {
  return Boolean(model && TENANT_SCOPED_MODELS.has(model));
}
