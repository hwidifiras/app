import type { Prisma } from "@prisma/client";

import type { ClubSettingsData } from "@/lib/club-settings";
import { sumLedgerRows } from "@/lib/payment-ledger";
import { resolveSubscriptionEffectiveState } from "@/modules/sales/subscription-lifecycle";
import {
  activateFirstUseSubscription,
  synchronizeDueRenewals,
} from "@/modules/sales/subscription-lifecycle-service";

export type GymAccessFailureCode =
  | "MEMBER_NOT_FOUND"
  | "MEMBER_ARCHIVED"
  | "NO_GYM_PASS"
  | "PASS_INACTIVE"
  | "PASS_FROZEN"
  | "PASS_UNPAID"
  | "PASS_EXHAUSTED"
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
  } | null;
  unitsDelta: number;
};

function dayWindow(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
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
  const member = await tx.member.findFirst({
    where: { id: params.memberId, tenantId: params.tenantId },
    select: { id: true, firstName: true, lastName: true, phone: true, status: true },
  });
  if (!member) {
    return { allowed: false, override: false, code: "MEMBER_NOT_FOUND", message: "Membre introuvable", member: null, entitlement: null, unitsDelta: 0 };
  }
  const publicMember = { id: member.id, firstName: member.firstName, lastName: member.lastName, phone: member.phone };
  if (member.status !== "ACTIVE") {
    return { allowed: false, override: false, code: "MEMBER_ARCHIVED", message: "Membre resilie: acces impossible", member: publicMember, entitlement: null, unitsDelta: 0 };
  }

  if (params.activatePending) {
    await synchronizeDueRenewals(tx, { tenantId: params.tenantId, memberId: member.id, at: now });
  }

  const entitlements = await tx.subscriptionEntitlement.findMany({
    where: {
      tenantId: params.tenantId,
      type: "GYM_ACCESS",
      memberSubscription: { tenantId: params.tenantId, memberId: member.id },
    },
    select: {
      id: true,
      memberSubscriptionId: true,
      gymAccessMode: true,
      remainingUnits: true,
      startDate: true,
      endDate: true,
      memberSubscription: {
        select: {
          status: true,
          activationPolicy: true,
          activationDeadline: true,
          activatedAt: true,
          startDate: true,
          endDate: true,
          amount: true,
          plan: { select: { name: true, validityDays: true } },
          payments: { select: { amount: true } },
          pauseEvents: { orderBy: { effectiveAt: "asc" } },
          renewedBySubscription: {
            select: { status: true, activationPolicy: true, activatedAt: true, startDate: true },
          },
        },
      },
    },
    orderBy: [{ endDate: "asc" }, { createdAt: "asc" }],
  });

  if (entitlements.length === 0) {
    return { allowed: false, override: false, code: "NO_GYM_PASS", message: "Aucun pass salle", member: publicMember, entitlement: null, unitsDelta: 0 };
  }

  const withState = entitlements.map((item) => ({
    item,
    state: resolveSubscriptionEffectiveState(item.memberSubscription, now),
  }));
  const active = withState.find((candidate) => candidate.state === "ACTIVE");
  const frozen = withState.find((candidate) => candidate.state === "FROZEN");
  const pending = withState.find((candidate) => candidate.state === "PENDING_ACTIVATION");
  const selectedCandidate = active ?? frozen ?? pending ?? withState[0];
  const selected = selectedCandidate.item;
  const totalPaid = sumLedgerRows(selected.memberSubscription.payments);
  const accessMode = selected.gymAccessMode ?? "UNLIMITED";
  const entitlement = {
    id: selected.id,
    memberSubscriptionId: selected.memberSubscriptionId,
    planName: selected.memberSubscription.plan.name,
    accessMode,
    remainingUnits: selected.remainingUnits,
    endDate: selected.endDate,
    amount: selected.memberSubscription.amount,
    totalPaid,
  };

  let code: GymAccessFailureCode | null = null;
  let message = "Acces autorise";
  if (selectedCandidate.state === "FROZEN") {
    code = "PASS_FROZEN";
    message = "Pass salle en pause";
  } else if (selectedCandidate.state !== "ACTIVE" && selectedCandidate.state !== "PENDING_ACTIVATION") {
    code = "PASS_INACTIVE";
    message = "Pass salle inactif ou expire";
  } else if (selected.memberSubscription.amount > 0 && totalPaid < selected.memberSubscription.amount) {
    const partialAllowed = params.settings.gymAllowCheckInWithPartialPayment && totalPaid > 0;
    if (!partialAllowed) {
      code = "PASS_UNPAID";
      message = "Paiement requis avant l'acces salle";
    }
  }
  if (!code && accessMode === "VISIT_QUOTA" && (selected.remainingUnits ?? 0) <= 0) {
    code = "PASS_EXHAUSTED";
    message = "Quota de visites epuise";
  }

  const { start, end } = dayWindow(now);
  if (!code) {
    const duplicateSince = new Date(now.getTime() - params.settings.gymDuplicateScanWindowMinutes * 60_000);
    const duplicate = await tx.gymVisit.findFirst({
      where: {
        tenantId: params.tenantId,
        memberId: member.id,
        entryType: "CHECK_IN",
        checkedAt: { gte: duplicateSince },
        corrections: { none: { entryType: "REVERSAL" } },
      },
      select: { id: true },
    });
    if (duplicate) {
      code = "DUPLICATE_SCAN";
      message = "Passage deja enregistre il y a quelques instants";
    }
  }

  if (!code && params.settings.gymDailyVisitLimit) {
    const visitsToday = await tx.gymVisit.count({
      where: {
        tenantId: params.tenantId,
        memberId: member.id,
        entryType: "CHECK_IN",
        checkedAt: { gte: start, lt: end },
        corrections: { none: { entryType: "REVERSAL" } },
      },
    });
    if (visitsToday >= params.settings.gymDailyVisitLimit) {
      code = "DAILY_LIMIT_REACHED";
      message = "Limite quotidienne atteinte";
    }
  }

  if (!code && selectedCandidate.state === "PENDING_ACTIVATION" && params.activatePending) {
    const activated = await activateFirstUseSubscription(tx, {
      tenantId: params.tenantId,
      subscriptionId: selected.memberSubscriptionId,
      actorId: params.actorId,
      at: now,
    });
    entitlement.endDate = activated.endDate;
  }

  if (!code) {
    return { allowed: true, override: false, code: null, message, member: publicMember, entitlement, unitsDelta: accessMode === "VISIT_QUOTA" ? -1 : 0 };
  }

  const overrideRequested = Boolean(params.overrideReason?.trim());
  const overrideAllowed = params.settings.gymAllowExceptionalAccess && overrideRequested;
  return {
    allowed: overrideAllowed,
    override: overrideAllowed,
    code,
    message: overrideAllowed ? `Acces exceptionnel: ${message}` : message,
    member: publicMember,
    entitlement,
    unitsDelta: 0,
  };
}
