import type {
  PlanActivationPolicy,
  SubscriptionPauseEntryType,
  SubscriptionStatus,
} from "@prisma/client";

export const SUBSCRIPTION_EFFECTIVE_STATES = [
  "PENDING_ACTIVATION",
  "SCHEDULED",
  "ACTIVE",
  "FROZEN",
  "EXPIRED",
  "CANCELLED",
] as const;

export type SubscriptionEffectiveState = (typeof SUBSCRIPTION_EFFECTIVE_STATES)[number];

export type SubscriptionPauseEventLike = {
  id: string;
  entryType: SubscriptionPauseEntryType;
  pauseEventId: string | null;
  effectiveAt: Date;
  durationSeconds?: number | null;
};

export type SubscriptionLifecycleLike = {
  status: SubscriptionStatus;
  activationPolicy: PlanActivationPolicy;
  activationDeadline: Date | null;
  activatedAt: Date | null;
  startDate: Date;
  endDate: Date | null;
  pauseEvents?: SubscriptionPauseEventLike[];
  renewedBySubscription?: {
    status: SubscriptionStatus;
    activationPolicy: PlanActivationPolicy;
    activatedAt: Date | null;
    startDate: Date;
  } | null;
};

export function findOpenPauseAt(
  events: SubscriptionPauseEventLike[] | undefined,
  at = new Date(),
) {
  if (!events?.length) return null;
  const resumedPauseIds = new Set(
    events
      .filter((event) => event.entryType === "RESUME" && event.effectiveAt <= at && event.pauseEventId)
      .map((event) => event.pauseEventId as string),
  );

  return events
    .filter(
      (event) =>
        event.entryType === "PAUSE" &&
        event.effectiveAt <= at &&
        !resumedPauseIds.has(event.id),
    )
    .sort((left, right) => right.effectiveAt.getTime() - left.effectiveAt.getTime())[0] ?? null;
}

export function totalPauseSeconds(events: SubscriptionPauseEventLike[] | undefined) {
  return (events ?? []).reduce(
    (total, event) => total + (event.entryType === "RESUME" ? Math.max(0, event.durationSeconds ?? 0) : 0),
    0,
  );
}

function successorHasTakenEffect(
  successor: SubscriptionLifecycleLike["renewedBySubscription"],
  at: Date,
) {
  if (!successor || successor.status === "CANCELLED" || successor.status === "EXPIRED") return false;
  if (successor.activationPolicy === "FIRST_USE") return Boolean(successor.activatedAt && successor.activatedAt <= at);
  return successor.startDate <= at;
}

export function resolveSubscriptionEffectiveState(
  subscription: SubscriptionLifecycleLike,
  at = new Date(),
): SubscriptionEffectiveState {
  if (subscription.status === "CANCELLED") return "CANCELLED";

  if (subscription.activationPolicy === "FIRST_USE" && !subscription.activatedAt) {
    if (subscription.status === "EXPIRED") return "EXPIRED";
    if (subscription.activationDeadline && subscription.activationDeadline < at) return "EXPIRED";
    return "PENDING_ACTIVATION";
  }

  if (subscription.status === "EXPIRED") return "EXPIRED";
  if (successorHasTakenEffect(subscription.renewedBySubscription, at)) return "EXPIRED";
  if (subscription.startDate > at || subscription.status === "DRAFT") return "SCHEDULED";
  if (subscription.endDate && subscription.endDate < at) return "EXPIRED";
  if (findOpenPauseAt(subscription.pauseEvents, at)) return "FROZEN";
  return "ACTIVE";
}

export function subscriptionAllowsAccess(subscription: SubscriptionLifecycleLike, at = new Date()) {
  return resolveSubscriptionEffectiveState(subscription, at) === "ACTIVE";
}
