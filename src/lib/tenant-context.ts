import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContext = {
  tenantId: string;
  tenantSlug: string;
  host?: string;
  requestCache?: Map<string, unknown>;
};

const tenantStorage = new AsyncLocalStorage<TenantContext>();
let fallbackTenantContext: TenantContext | null = null;

export const TENANT_SCOPED_MODELS = new Set([
  "User",
  "UserPermission",
  "PasswordResetToken",
  "IdempotencyRecord",
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
  "ScheduleTemplate",
  "ScheduleTemplateSlot",
  "Session",
  "SubscriptionPlan",
  "MemberSubscription",
  "Payment",
  "Receipt",
  "Offer",
  "OfferApplication",
  "Attendance",
  "TenantModule",
  "TenantSaasSubscription",
  "PlanEntitlement",
  "SubscriptionEntitlement",
  "SubscriptionPause",
  "EntitlementAdjustment",
  "GymVisit",
  "MemberAccessCredential",
  "GymAccessAttempt",
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

export function memoizeTenantRequest<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const context = tenantStorage.getStore();
  if (!context) return factory();

  const requestCache = context.requestCache ?? new Map<string, unknown>();
  context.requestCache = requestCache;

  const cached = requestCache.get(key) as Promise<T> | undefined;
  if (cached) return cached;

  const value = factory();
  requestCache.set(key, value);
  return value;
}

export function isTenantScopedModel(model: string | undefined): boolean {
  return Boolean(model && TENANT_SCOPED_MODELS.has(model));
}
