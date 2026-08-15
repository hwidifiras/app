import { Prisma } from "@prisma/client";

import type { ClubSettingsData } from "@/lib/club-settings";
import { sumLedgerRows } from "@/lib/payment-ledger";
import { gymLocalDayRange, isGymOpenAt } from "@/modules/gym/opening-hours";
import { resolveSubscriptionEffectiveState, type SubscriptionEffectiveState } from "@/modules/sales/subscription-lifecycle";
import {
  activateFirstUseSubscription,
  synchronizeDueRenewals,
} from "@/modules/sales/subscription-lifecycle-service";

export type GymAccessFailureCode =
  | "MEMBER_NOT_FOUND"
  | "MEMBER_ARCHIVED"
  | "CREDENTIAL_INVALID"
  | "CREDENTIAL_REVOKED"
  | "NO_GYM_PASS"
  | "PASS_INACTIVE"
  | "PASS_FROZEN"
  | "PASS_UNPAID"
  | "PASS_EXHAUSTED"
  | "CLUB_CLOSED"
  | "DUPLICATE_SCAN"
  | "DAILY_LIMIT_REACHED";

export type GymAccessDecision = {
  allowed: boolean;
  override: boolean;
  code: GymAccessFailureCode | null;
  message: string;
  member: { id: string; firstName: string; lastName: string; phone: string } | null;
  entitlement: {
    id: string;
    memberSubscriptionId: string;
    planName: string;
    accessMode: "UNLIMITED" | "VISIT_QUOTA";
    remainingUnits: number | null;
    endDate: Date | null;
    amount: number;
    totalPaid: number;
    effectiveState: SubscriptionEffectiveState;
  } | null;
  unitsDelta: number;
  visitsToday: number;
  lastVisitAt: Date | null;
};

const gymEntitlementSelect = {
  id: true,
  memberSubscriptionId: true,
  gymAccessMode: true,
  remainingUnits: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  memberSubscription: {
    select: {
      memberId: true,
      status: true,
      activationPolicy: true,
      activationDeadline: true,
      activatedAt: true,
      startDate: true,
      endDate: true,
      amount: true,
      plan: { select: { name: true, validityDays: true } },
      payments: { select: { amount: true } },
      pauseEvents: { orderBy: { effectiveAt: "asc" as const } },
      renewedBySubscription: {
        select: { status: true, activationPolicy: true, activatedAt: true, startDate: true },
      },
    },
  },
} satisfies Prisma.SubscriptionEntitlementSelect;

type GymEntitlementRow = Prisma.SubscriptionEntitlementGetPayload<{ select: typeof gymEntitlementSelect }>;
type GymMemberRow = { id: string; firstName: string; lastName: string; phone: string; status: string };
type GymVisitRow = { memberId: string; checkedAt: Date; corrections: Array<{ id: string }> };

function deniedDecision(
  code: GymAccessFailureCode,
  message: string,
  member: GymAccessDecision["member"] = null,
): GymAccessDecision {
  return {
    allowed: false,
    override: false,
    code,
    message,
    member,
    entitlement: null,
    unitsDelta: 0,
    visitsToday: 0,
    lastVisitAt: null,
  };
}

export function invalidGymCredentialDecision(revoked = false): GymAccessDecision {
  return deniedDecision(
    revoked ? "CREDENTIAL_REVOKED" : "CREDENTIAL_INVALID",
    revoked ? "Cette carte d'accès a été révoquée" : "Carte d'accès inconnue ou invalide",
  );
}

function selectCandidate(entitlements: GymEntitlementRow[], now: Date) {
  const withState = entitlements.map((item) => ({
    item,
    state: resolveSubscriptionEffectiveState(item.memberSubscription, now),
  }));
  return withState.find((candidate) => candidate.state === "ACTIVE")
    ?? withState.find((candidate) => candidate.state === "FROZEN")
    ?? withState.find((candidate) => candidate.state === "PENDING_ACTIVATION")
    ?? withState[0]
    ?? null;
}

function buildDecision(input: {
  member: GymMemberRow | null;
  entitlements: GymEntitlementRow[];
  visits: GymVisitRow[];
  settings: ClubSettingsData;
  now: Date;
  overrideReason?: string | null;
}) {
  if (!input.member) {
    return { decision: deniedDecision("MEMBER_NOT_FOUND", "Membre introuvable"), pendingActivation: false };
  }
  const member = {
    id: input.member.id,
    firstName: input.member.firstName,
    lastName: input.member.lastName,
    phone: input.member.phone,
  };
  if (input.member.status !== "ACTIVE") {
    return {
      decision: deniedDecision("MEMBER_ARCHIVED", "Membre résilié : accès impossible", member),
      pendingActivation: false,
    };
  }

  const selectedCandidate = selectCandidate(input.entitlements, input.now);
  if (!selectedCandidate) {
    return { decision: deniedDecision("NO_GYM_PASS", "Aucun pass salle", member), pendingActivation: false };
  }

  const selected = selectedCandidate.item;
  const totalPaid = sumLedgerRows(selected.memberSubscription.payments);
  const accessMode = selected.gymAccessMode ?? "UNLIMITED";
  const { start: dayStart, end: dayEnd } = gymLocalDayRange(input.now);
  const validVisits = input.visits.filter((visit) => visit.corrections.length === 0);
  const visitsToday = validVisits.filter((visit) => visit.checkedAt >= dayStart && visit.checkedAt < dayEnd).length;
  const lastVisitAt = validVisits.reduce<Date | null>(
    (latest, visit) => !latest || visit.checkedAt > latest ? visit.checkedAt : latest,
    null,
  );
  const entitlement: NonNullable<GymAccessDecision["entitlement"]> = {
    id: selected.id,
    memberSubscriptionId: selected.memberSubscriptionId,
    planName: selected.memberSubscription.plan.name,
    accessMode,
    remainingUnits: selected.remainingUnits,
    endDate: selected.endDate,
    amount: selected.memberSubscription.amount,
    totalPaid,
    effectiveState: selectedCandidate.state,
  };

  let code: GymAccessFailureCode | null = null;
  let message = "Accès autorisé";
  if (selectedCandidate.state === "FROZEN") {
    code = "PASS_FROZEN";
    message = "Pass salle en pause";
  } else if (selectedCandidate.state !== "ACTIVE" && selectedCandidate.state !== "PENDING_ACTIVATION") {
    code = "PASS_INACTIVE";
    message = "Pass salle inactif ou expiré";
  } else if (input.settings.gymEnforceOpeningHours && !isGymOpenAt(input.settings.gymOpeningHours, input.now)) {
    code = "CLUB_CLOSED";
    message = "Club fermé à cette heure";
  } else if (selected.memberSubscription.amount > 0 && totalPaid < selected.memberSubscription.amount) {
    const partialAllowed = input.settings.gymAllowCheckInWithPartialPayment && totalPaid > 0;
    if (!partialAllowed) {
      code = "PASS_UNPAID";
      message = "Paiement requis avant l'accès salle";
    }
  }
  if (!code && accessMode === "VISIT_QUOTA" && (selected.remainingUnits ?? 0) <= 0) {
    code = "PASS_EXHAUSTED";
    message = "Quota de visites épuisé";
  }

  if (!code && input.settings.gymDuplicateScanWindowMinutes > 0) {
    const duplicateSince = new Date(input.now.getTime() - input.settings.gymDuplicateScanWindowMinutes * 60_000);
    if (validVisits.some((visit) => visit.checkedAt >= duplicateSince)) {
      code = "DUPLICATE_SCAN";
      message = "Passage déjà enregistré il y a quelques instants";
    }
  }

  if (!code && input.settings.gymDailyVisitLimit && visitsToday >= input.settings.gymDailyVisitLimit) {
    code = "DAILY_LIMIT_REACHED";
    message = "Limite quotidienne atteinte";
  }

  const normalUnitsDelta = accessMode === "VISIT_QUOTA" ? -1 : 0;
  if (!code) {
    return {
      decision: {
        allowed: true,
        override: false,
        code: null,
        message,
        member,
        entitlement,
        unitsDelta: normalUnitsDelta,
        visitsToday,
        lastVisitAt,
      },
      pendingActivation: selectedCandidate.state === "PENDING_ACTIVATION",
    };
  }

  const overrideRequested = Boolean(input.overrideReason?.trim());
  const overrideAllowed = input.settings.gymAllowExceptionalAccess && overrideRequested;
  const overrideUnitsDelta = accessMode === "VISIT_QUOTA" && (selected.remainingUnits ?? 0) > 0 ? -1 : 0;
  return {
    decision: {
      allowed: overrideAllowed,
      override: overrideAllowed,
      code,
      message: overrideAllowed ? `Accès exceptionnel : ${message}` : message,
      member,
      entitlement,
      unitsDelta: overrideAllowed ? overrideUnitsDelta : 0,
      visitsToday,
      lastVisitAt,
    },
    pendingActivation: selectedCandidate.state === "PENDING_ACTIVATION",
  };
}

async function loadGymPolicyRows(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; memberIds: string[]; now: Date; settings: ClubSettingsData },
) {
  if (input.memberIds.length === 0) return { members: [], entitlements: [], visits: [] };
  const { start: dayStart } = gymLocalDayRange(input.now);
  const duplicateSince = new Date(input.now.getTime() - input.settings.gymDuplicateScanWindowMinutes * 60_000);
  const visitSince = dayStart < duplicateSince ? dayStart : duplicateSince;
  const [members, entitlements, policyVisits, latestVisits] = await Promise.all([
    tx.member.findMany({
      where: { tenantId: input.tenantId, id: { in: input.memberIds } },
      select: { id: true, firstName: true, lastName: true, phone: true, status: true },
    }),
    tx.subscriptionEntitlement.findMany({
      where: {
        tenantId: input.tenantId,
        type: "GYM_ACCESS",
        memberSubscription: { tenantId: input.tenantId, memberId: { in: input.memberIds } },
      },
      select: gymEntitlementSelect,
      orderBy: [{ endDate: "asc" }, { createdAt: "asc" }],
    }),
    tx.gymVisit.findMany({
      where: {
        tenantId: input.tenantId,
        memberId: { in: input.memberIds },
        entryType: "CHECK_IN",
        checkedAt: { gte: visitSince },
      },
      select: {
        memberId: true,
        checkedAt: true,
        corrections: { where: { entryType: "REVERSAL" }, select: { id: true } },
      },
    }),
    tx.gymVisit.findMany({
      where: { tenantId: input.tenantId, memberId: { in: input.memberIds }, entryType: "CHECK_IN" },
      select: {
        memberId: true,
        checkedAt: true,
        corrections: { where: { entryType: "REVERSAL" }, select: { id: true } },
      },
      orderBy: { checkedAt: "desc" },
      take: Math.max(50, input.memberIds.length * 10),
    }),
  ]);

  const seen = new Set(policyVisits.map((visit) => `${visit.memberId}:${visit.checkedAt.getTime()}`));
  const visits = [...policyVisits];
  for (const visit of latestVisits) {
    const key = `${visit.memberId}:${visit.checkedAt.getTime()}`;
    if (!seen.has(key)) visits.push(visit);
  }
  return { members, entitlements, visits };
}

export async function evaluateGymAccessBatch(
  tx: Prisma.TransactionClient,
  params: { tenantId: string; memberIds: string[]; settings: ClubSettingsData; now?: Date },
): Promise<GymAccessDecision[]> {
  const now = params.now ?? new Date();
  const memberIds = [...new Set(params.memberIds)];
  const rows = await loadGymPolicyRows(tx, { ...params, memberIds, now });
  const members = new Map(rows.members.map((member) => [member.id, member]));
  const entitlements = new Map<string, GymEntitlementRow[]>();
  for (const entitlement of rows.entitlements) {
    const memberId = entitlement.memberSubscription.memberId;
    entitlements.set(memberId, [...(entitlements.get(memberId) ?? []), entitlement]);
  }
  const visits = new Map<string, GymVisitRow[]>();
  for (const visit of rows.visits) visits.set(visit.memberId, [...(visits.get(visit.memberId) ?? []), visit]);

  return params.memberIds.map((memberId) => buildDecision({
    member: members.get(memberId) ?? null,
    entitlements: entitlements.get(memberId) ?? [],
    visits: visits.get(memberId) ?? [],
    settings: params.settings,
    now,
  }).decision);
}

export async function evaluateGymAccess(
  tx: Prisma.TransactionClient,
  params: {
    tenantId: string;
    memberId: string;
    settings: ClubSettingsData;
    now?: Date;
    overrideReason?: string | null;
    actorId?: string | null;
    activatePending?: boolean;
  },
): Promise<GymAccessDecision> {
  const now = params.now ?? new Date();
  if (params.activatePending) {
    await synchronizeDueRenewals(tx, { tenantId: params.tenantId, memberId: params.memberId, at: now });
  }
  const rows = await loadGymPolicyRows(tx, {
    tenantId: params.tenantId,
    memberIds: [params.memberId],
    settings: params.settings,
    now,
  });
  const built = buildDecision({
    member: rows.members[0] ?? null,
    entitlements: rows.entitlements,
    visits: rows.visits,
    settings: params.settings,
    now,
    overrideReason: params.overrideReason,
  });
  if (built.decision.allowed && built.pendingActivation && params.activatePending && built.decision.entitlement) {
    const activated = await activateFirstUseSubscription(tx, {
      tenantId: params.tenantId,
      subscriptionId: built.decision.entitlement.memberSubscriptionId,
      actorId: params.actorId,
      at: now,
    });
    built.decision.entitlement.endDate = activated.endDate;
    built.decision.entitlement.effectiveState = "ACTIVE";
  }
  return built.decision;
}
