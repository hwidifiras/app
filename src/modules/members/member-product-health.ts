import type {
  GymAccessMode,
  PlanActivationPolicy,
  PlanKind,
  SubscriptionPauseEntryType,
  SubscriptionStatus,
} from "@prisma/client";

import {
  findOpenPauseAt,
  resolveSubscriptionEffectiveState,
  type SubscriptionEffectiveState,
} from "@/modules/sales/subscription-lifecycle";

type MemberHealthEntitlement = {
  type: "CLASS_SESSIONS" | "GYM_ACCESS";
  sport?: { name: string } | null;
  remainingUnits: number | null;
  grantedUnits: number | null;
  gymAccessMode: GymAccessMode | null;
};

type MemberHealthSubscription = {
  id: string;
  amount: number;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date | null;
  activationPolicy: PlanActivationPolicy;
  activationDeadline: Date | null;
  activatedAt: Date | null;
  plan: { name: string; planKind: PlanKind };
  payments: Array<{ amount: number }>;
  entitlements: MemberHealthEntitlement[];
  pauseEvents: Array<{
    id: string;
    entryType: SubscriptionPauseEntryType;
    pauseEventId: string | null;
    effectiveAt: Date;
    durationSeconds: number | null;
  }>;
  renewedBySubscription?: {
    status: SubscriptionStatus;
    activationPolicy: PlanActivationPolicy;
    activatedAt: Date | null;
    startDate: Date;
  } | null;
};

export type MemberNextActionKind =
  | "COLLECT"
  | "RESUME"
  | "GYM_CHECK_IN"
  | "ASSIGN_CLASS"
  | "RENEW"
  | "NONE";

export type MemberProductHealth = {
  debtCents: number;
  currentSubscriptionCount: number;
  subscriptionLabel: string;
  classRightsLabel: string | null;
  gymAccessLabel: string | null;
  validityLabel: string;
  lastActivityLabel: string;
  nextActionKind: MemberNextActionKind;
  nextActionSubscriptionId: string | null;
  nextActionPlanKind: PlanKind | null;
};

type BuildMemberProductHealthInput = {
  memberStatus: "ACTIVE" | "ARCHIVED";
  subscriptions: MemberHealthSubscription[];
  activeGroupsCount: number;
  hasClassModule: boolean;
  hasGymModule: boolean;
  lastClassAttendanceAt?: Date | null;
  lastGymVisitAt?: Date | null;
  now?: Date;
};

type ResolvedSubscription = {
  subscription: MemberHealthSubscription;
  state: SubscriptionEffectiveState;
};

const currentStates = new Set<SubscriptionEffectiveState>([
  "ACTIVE",
  "FROZEN",
  "PENDING_ACTIVATION",
  "SCHEDULED",
]);

function formatDate(date: Date) {
  return date.toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

function relevantRightRows(rows: ResolvedSubscription[]) {
  const live = rows.filter((row) => row.state !== "SCHEDULED");
  return live.length > 0 ? live : rows;
}

function subscriptionLabel(rows: ResolvedSubscription[]) {
  const live = rows.filter((row) => row.state === "ACTIVE");
  if (live.length === 1) return live[0].subscription.plan.name;
  if (live.length > 1) return `${live.length} formules actives`;

  const frozen = rows.find((row) => row.state === "FROZEN");
  if (frozen) return `${frozen.subscription.plan.name} · Gelée`;
  const pending = rows.find((row) => row.state === "PENDING_ACTIVATION");
  if (pending) return `${pending.subscription.plan.name} · À activer`;
  const scheduled = rows.find((row) => row.state === "SCHEDULED");
  if (scheduled) return `${scheduled.subscription.plan.name} · Planifiée`;
  return "À renouveler";
}

function classRightsLabel(rows: ResolvedSubscription[]) {
  const rights = relevantRightRows(rows).flatMap(({ subscription, state }) =>
    subscription.entitlements
      .filter((right) => right.type === "CLASS_SESSIONS")
      .map((right) => ({ right, state, startDate: subscription.startDate })),
  );
  if (rights.length === 0) return "Aucun droit cours";

  return rights.map(({ right, state, startDate }) => {
    const name = right.sport?.name ?? "Cours";
    if (state === "FROZEN") return `${name} · gelé`;
    if (state === "SCHEDULED") return `${name} · dès le ${formatDate(startDate)}`;
    const remaining = Math.max(0, right.remainingUnits ?? 0);
    return right.grantedUnits == null
      ? `${name} · ${remaining} séances`
      : `${name} · ${remaining}/${right.grantedUnits}`;
  }).join(" · ");
}

function gymAccessLabel(rows: ResolvedSubscription[]) {
  const candidates = relevantRightRows(rows).flatMap(({ subscription, state }) =>
    subscription.entitlements
      .filter((right) => right.type === "GYM_ACCESS")
      .map((right) => ({ right, state, startDate: subscription.startDate })),
  );
  const candidate = candidates[0];
  if (!candidate) return "Aucun pass salle";
  if (candidate.state === "FROZEN") return "Accès gelé";
  if (candidate.state === "PENDING_ACTIVATION") return "À activer au 1er passage";
  if (candidate.state === "SCHEDULED") return `Disponible le ${formatDate(candidate.startDate)}`;
  if (candidate.right.gymAccessMode === "UNLIMITED") return "Accès illimité";
  return `${Math.max(0, candidate.right.remainingUnits ?? 0)}/${candidate.right.grantedUnits ?? 0} visites`;
}

function validityLabel(rows: ResolvedSubscription[]) {
  const frozen = rows.find((row) => row.state === "FROZEN");
  if (frozen) {
    const pause = findOpenPauseAt(frozen.subscription.pauseEvents);
    return pause ? `Gelée depuis le ${formatDate(pause.effectiveAt)}` : "Formule gelée";
  }

  const pending = rows
    .filter((row) => row.state === "PENDING_ACTIVATION" && row.subscription.activationDeadline)
    .sort((left, right) =>
      (left.subscription.activationDeadline as Date).getTime()
      - (right.subscription.activationDeadline as Date).getTime(),
    )[0];
  if (pending?.subscription.activationDeadline) {
    return `À activer avant le ${formatDate(pending.subscription.activationDeadline)}`;
  }

  const activeEnd = rows
    .filter((row) => row.state === "ACTIVE" && row.subscription.endDate)
    .sort((left, right) =>
      (left.subscription.endDate as Date).getTime() - (right.subscription.endDate as Date).getTime(),
    )[0];
  if (activeEnd?.subscription.endDate) return `Expire le ${formatDate(activeEnd.subscription.endDate)}`;

  const scheduled = rows
    .filter((row) => row.state === "SCHEDULED")
    .sort((left, right) => left.subscription.startDate.getTime() - right.subscription.startDate.getTime())[0];
  if (scheduled) return `Commence le ${formatDate(scheduled.subscription.startDate)}`;
  return rows.some((row) => row.state === "ACTIVE") ? "Sans date de fin" : "Aucun droit en cours";
}

function lastActivityLabel(input: BuildMemberProductHealthInput) {
  const attendance = input.lastClassAttendanceAt ?? null;
  const gymVisit = input.lastGymVisitAt ?? null;
  if (!attendance && !gymVisit) return "Aucune activité";
  if (attendance && (!gymVisit || attendance >= gymVisit)) return `Cours · ${formatDate(attendance)}`;
  return `Salle · ${formatDate(gymVisit as Date)}`;
}

function isRenewalOpportunity(row: ResolvedSubscription, now: Date) {
  if (row.state !== "ACTIVE") return false;
  const inSevenDays = new Date(now);
  inSevenDays.setUTCDate(inSevenDays.getUTCDate() + 7);
  if (row.subscription.endDate && row.subscription.endDate <= inSevenDays) return true;
  return row.subscription.entitlements.some((right) =>
    right.remainingUnits != null
    && right.remainingUnits <= 2
    && (right.type === "CLASS_SESSIONS" || right.gymAccessMode === "VISIT_QUOTA"),
  );
}

function nextAction(
  input: BuildMemberProductHealthInput,
  rows: ResolvedSubscription[],
  debtCents: number,
): Pick<MemberProductHealth, "nextActionKind" | "nextActionSubscriptionId" | "nextActionPlanKind"> {
  const none = {
    nextActionKind: "NONE" as const,
    nextActionSubscriptionId: null,
    nextActionPlanKind: null,
  };
  if (input.memberStatus !== "ACTIVE") return none;

  const due = rows.find((row) => row.state !== "CANCELLED" && row.subscription.amount > 0);
  if (debtCents > 0) {
    return {
      nextActionKind: "COLLECT",
      nextActionSubscriptionId: due?.subscription.id ?? null,
      nextActionPlanKind: due?.subscription.plan.planKind ?? null,
    };
  }

  const frozen = rows.find((row) => row.state === "FROZEN");
  if (frozen) {
    return {
      nextActionKind: "RESUME",
      nextActionSubscriptionId: frozen.subscription.id,
      nextActionPlanKind: frozen.subscription.plan.planKind,
    };
  }

  const pendingGym = rows.find((row) =>
    row.state === "PENDING_ACTIVATION"
    && row.subscription.entitlements.some((right) => right.type === "GYM_ACCESS"),
  );
  if (pendingGym) {
    return {
      nextActionKind: "GYM_CHECK_IN",
      nextActionSubscriptionId: pendingGym.subscription.id,
      nextActionPlanKind: pendingGym.subscription.plan.planKind,
    };
  }

  const live = rows.filter((row) => row.state === "ACTIVE");
  if (live.length === 0 && !rows.some((row) => row.state === "SCHEDULED")) {
    const latest = rows[0];
    return {
      nextActionKind: "RENEW",
      nextActionSubscriptionId: latest?.subscription.id ?? null,
      nextActionPlanKind: latest?.subscription.plan.planKind ?? null,
    };
  }

  const hasClassRight = live.some((row) =>
    row.subscription.entitlements.some((right) => right.type === "CLASS_SESSIONS"),
  );
  if (hasClassRight && input.activeGroupsCount === 0) {
    const target = live.find((row) =>
      row.subscription.entitlements.some((right) => right.type === "CLASS_SESSIONS"),
    );
    return {
      nextActionKind: "ASSIGN_CLASS",
      nextActionSubscriptionId: target?.subscription.id ?? null,
      nextActionPlanKind: target?.subscription.plan.planKind ?? null,
    };
  }

  const renewal = rows.find((row) => isRenewalOpportunity(row, input.now ?? new Date()));
  if (renewal) {
    return {
      nextActionKind: "RENEW",
      nextActionSubscriptionId: renewal.subscription.id,
      nextActionPlanKind: renewal.subscription.plan.planKind,
    };
  }
  return none;
}

export function buildMemberProductHealth(input: BuildMemberProductHealthInput): MemberProductHealth {
  const now = input.now ?? new Date();
  const resolved = input.subscriptions.map((subscription) => ({
    subscription,
    state: resolveSubscriptionEffectiveState(subscription, now),
  }));
  const current = resolved.filter((row) => currentStates.has(row.state));
  const debtCents = input.subscriptions.reduce((total, subscription) => {
    if (subscription.status === "CANCELLED") return total;
    const paid = subscription.payments.reduce((sum, payment) => sum + payment.amount, 0);
    return total + Math.max(0, subscription.amount - paid);
  }, 0);

  return {
    debtCents,
    currentSubscriptionCount: current.length,
    subscriptionLabel: subscriptionLabel(current),
    classRightsLabel: input.hasClassModule ? classRightsLabel(current) : null,
    gymAccessLabel: input.hasGymModule ? gymAccessLabel(current) : null,
    validityLabel: validityLabel(current),
    lastActivityLabel: lastActivityLabel(input),
    ...nextAction({ ...input, now }, resolved, debtCents),
  };
}
