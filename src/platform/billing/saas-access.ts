import type { SaasSubscriptionStatus, TenantStatus } from "@prisma/client";

export type EffectiveSaasStatus = SaasSubscriptionStatus | "LEGACY_ACTIVE";

export type SaasSubscriptionAccessInput = {
  id: string;
  status: SaasSubscriptionStatus;
  startsAt: Date;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  graceEndsAt: Date | null;
  plan: {
    code: string;
    name: string;
    userLimit: number | null;
    memberLimit: number | null;
  };
} | null;

export type SaasOperationalAccess = {
  status: EffectiveSaasStatus;
  canOperate: boolean;
  warning: "PAST_DUE" | "GRACE" | null;
  subscription: {
    id: string;
    planCode: string;
    planName: string;
    startsAt: Date;
    trialEndsAt: Date | null;
    currentPeriodEnd: Date | null;
    graceEndsAt: Date | null;
    userLimit: number | null;
    memberLimit: number | null;
  } | null;
};

const OPERATING_STATUSES = new Set<SaasSubscriptionStatus>([
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "GRACE",
]);

export function resolveSaasOperationalAccess(input: {
  tenantStatus: TenantStatus;
  subscription: SaasSubscriptionAccessInput;
}): SaasOperationalAccess {
  const { subscription } = input;

  if (!subscription) {
    return {
      status: "LEGACY_ACTIVE",
      canOperate: input.tenantStatus === "ACTIVE",
      warning: null,
      subscription: null,
    };
  }

  return {
    status: subscription.status,
    canOperate: input.tenantStatus === "ACTIVE" && OPERATING_STATUSES.has(subscription.status),
    warning:
      subscription.status === "PAST_DUE"
        ? "PAST_DUE"
        : subscription.status === "GRACE"
          ? "GRACE"
          : null,
    subscription: {
      id: subscription.id,
      planCode: subscription.plan.code,
      planName: subscription.plan.name,
      startsAt: subscription.startsAt,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      graceEndsAt: subscription.graceEndsAt,
      userLimit: subscription.plan.userLimit,
      memberLimit: subscription.plan.memberLimit,
    },
  };
}

export function isSaasRecoveryPath(pathname: string): boolean {
  return (
    pathname === "/subscription-status" ||
    pathname.startsWith("/subscription-status/") ||
    pathname === "/settings/account" ||
    pathname.startsWith("/settings/account/") ||
    pathname === "/api/account" ||
    pathname.startsWith("/api/account/")
  );
}
