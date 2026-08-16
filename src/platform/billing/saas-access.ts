import type { SaasSubscriptionStatus, TenantStatus } from "@prisma/client";

export type EffectiveSaasStatus = SaasSubscriptionStatus | "LEGACY_ACTIVE";

export type SaasSubscriptionAccessInput = {
  id: string;
  status: SaasSubscriptionStatus;
  automaticLifecycle: boolean;
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

export type SaasBillingWarning = "TRIAL_ENDING" | "TRIAL_GRACE" | "PAST_DUE" | "GRACE";

export type SaasBlockReason =
  | "TENANT_SUSPENDED"
  | "TRIAL_EXPIRED"
  | "BILLING_GRACE_EXPIRED"
  | "SUBSCRIPTION_SUSPENDED"
  | "SUBSCRIPTION_CANCELLED";

export type SaasOperationalAccess = {
  status: EffectiveSaasStatus;
  canOperate: boolean;
  warning: SaasBillingWarning | null;
  blockReason: SaasBlockReason | null;
  deadlineAt: Date | null;
  daysRemaining: number | null;
  subscription: {
    id: string;
    planCode: string;
    planName: string;
    automaticLifecycle: boolean;
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

const TRIAL_WARNING_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1_000;

type SubscriptionLifecycle = Pick<
  SaasOperationalAccess,
  "status" | "canOperate" | "warning" | "blockReason" | "deadlineAt" | "daysRemaining"
>;

function daysUntil(deadline: Date | null, now: Date): number | null {
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS));
}

function hasEnded(deadline: Date | null, now: Date): boolean {
  return deadline !== null && deadline.getTime() <= now.getTime();
}

function blockedLifecycle(
  status: Extract<EffectiveSaasStatus, "SUSPENDED" | "CANCELLED">,
  blockReason: SaasBlockReason,
  deadlineAt: Date | null = null,
): SubscriptionLifecycle {
  return {
    status,
    canOperate: false,
    warning: null,
    blockReason,
    deadlineAt,
    daysRemaining: 0,
  };
}

function resolveManualLifecycle(subscription: NonNullable<SaasSubscriptionAccessInput>): SubscriptionLifecycle {
  const canOperate = OPERATING_STATUSES.has(subscription.status);
  return {
    status: subscription.status,
    canOperate,
    warning:
      subscription.status === "PAST_DUE"
        ? "PAST_DUE"
        : subscription.status === "GRACE"
          ? "GRACE"
          : null,
    blockReason:
      subscription.status === "CANCELLED"
        ? "SUBSCRIPTION_CANCELLED"
        : subscription.status === "SUSPENDED"
          ? "SUBSCRIPTION_SUSPENDED"
          : null,
    deadlineAt: null,
    daysRemaining: null,
  };
}

function resolveAutomaticLifecycle(
  subscription: NonNullable<SaasSubscriptionAccessInput>,
  now: Date,
): SubscriptionLifecycle {
  if (subscription.status === "CANCELLED") {
    return blockedLifecycle("CANCELLED", "SUBSCRIPTION_CANCELLED");
  }
  if (subscription.status === "SUSPENDED") {
    return blockedLifecycle("SUSPENDED", "SUBSCRIPTION_SUSPENDED");
  }

  if (subscription.status === "TRIAL") {
    if (!hasEnded(subscription.trialEndsAt, now)) {
      const remaining = daysUntil(subscription.trialEndsAt, now);
      return {
        status: "TRIAL",
        canOperate: true,
        warning: remaining !== null && remaining <= TRIAL_WARNING_DAYS ? "TRIAL_ENDING" : null,
        blockReason: null,
        deadlineAt: subscription.trialEndsAt,
        daysRemaining: remaining,
      };
    }

    if (subscription.graceEndsAt && !hasEnded(subscription.graceEndsAt, now)) {
      return {
        status: "GRACE",
        canOperate: true,
        warning: "TRIAL_GRACE",
        blockReason: null,
        deadlineAt: subscription.graceEndsAt,
        daysRemaining: daysUntil(subscription.graceEndsAt, now),
      };
    }

    return blockedLifecycle("SUSPENDED", "TRIAL_EXPIRED", subscription.graceEndsAt ?? subscription.trialEndsAt);
  }

  if (subscription.status === "ACTIVE" && hasEnded(subscription.currentPeriodEnd, now)) {
    if (subscription.graceEndsAt && !hasEnded(subscription.graceEndsAt, now)) {
      return {
        status: "GRACE",
        canOperate: true,
        warning: "GRACE",
        blockReason: null,
        deadlineAt: subscription.graceEndsAt,
        daysRemaining: daysUntil(subscription.graceEndsAt, now),
      };
    }
    if (subscription.graceEndsAt) {
      return blockedLifecycle("SUSPENDED", "BILLING_GRACE_EXPIRED", subscription.graceEndsAt);
    }
    return {
      status: "PAST_DUE",
      canOperate: true,
      warning: "PAST_DUE",
      blockReason: null,
      deadlineAt: subscription.currentPeriodEnd,
      daysRemaining: 0,
    };
  }

  if (subscription.status === "PAST_DUE") {
    if (hasEnded(subscription.graceEndsAt, now)) {
      return blockedLifecycle("SUSPENDED", "BILLING_GRACE_EXPIRED", subscription.graceEndsAt);
    }
    return {
      status: "PAST_DUE",
      canOperate: true,
      warning: "PAST_DUE",
      blockReason: null,
      deadlineAt: subscription.graceEndsAt ?? subscription.currentPeriodEnd,
      daysRemaining: daysUntil(subscription.graceEndsAt, now),
    };
  }

  if (subscription.status === "GRACE") {
    if (hasEnded(subscription.graceEndsAt, now)) {
      return blockedLifecycle("SUSPENDED", "BILLING_GRACE_EXPIRED", subscription.graceEndsAt);
    }
    return {
      status: "GRACE",
      canOperate: true,
      warning: "GRACE",
      blockReason: null,
      deadlineAt: subscription.graceEndsAt,
      daysRemaining: daysUntil(subscription.graceEndsAt, now),
    };
  }

  return {
    status: subscription.status,
    canOperate: true,
    warning: null,
    blockReason: null,
    deadlineAt: subscription.currentPeriodEnd,
    daysRemaining: daysUntil(subscription.currentPeriodEnd, now),
  };
}

export function resolveSaasOperationalAccess(input: {
  tenantStatus: TenantStatus;
  subscription: SaasSubscriptionAccessInput;
  now?: Date;
}): SaasOperationalAccess {
  const { subscription } = input;

  if (!subscription) {
    return {
      status: "LEGACY_ACTIVE",
      canOperate: input.tenantStatus === "ACTIVE",
      warning: null,
      blockReason: input.tenantStatus === "ACTIVE" ? null : "TENANT_SUSPENDED",
      deadlineAt: null,
      daysRemaining: null,
      subscription: null,
    };
  }

  const lifecycle = subscription.automaticLifecycle
    ? resolveAutomaticLifecycle(subscription, input.now ?? new Date())
    : resolveManualLifecycle(subscription);
  const tenantCanOperate = input.tenantStatus === "ACTIVE";

  return {
    ...lifecycle,
    canOperate: tenantCanOperate && lifecycle.canOperate,
    warning: tenantCanOperate ? lifecycle.warning : null,
    blockReason: tenantCanOperate ? lifecycle.blockReason : "TENANT_SUSPENDED",
    subscription: {
      id: subscription.id,
      planCode: subscription.plan.code,
      planName: subscription.plan.name,
      automaticLifecycle: subscription.automaticLifecycle,
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
