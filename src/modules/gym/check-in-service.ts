import type { PrismaClient } from "@prisma/client";

import type { ClubSettingsData } from "@/lib/club-settings";
import {
  evaluateGymAccess,
  invalidGymCredentialDecision,
} from "@/lib/gym-access-policy";
import { recordGymAccessDecision } from "@/modules/gym/access-attempts";
import { resolveGymCredential } from "@/modules/gym/access-credentials";

export async function recordGymCheckIn(
  db: PrismaClient,
  input: {
    tenantId: string;
    actorId: string;
    settings: ClubSettingsData;
    memberId?: string;
    credentialCode?: string;
    overrideReason?: string;
    now?: Date;
  },
) {
  return db.$transaction(async (tx) => {
    const now = input.now ?? new Date();
    const resolvedCredential = input.credentialCode
      ? await resolveGymCredential(tx, {
          tenantId: input.tenantId,
          credentialCode: input.credentialCode,
        })
      : null;

    if (resolvedCredential && resolvedCredential.status !== "ACTIVE") {
      const decision = invalidGymCredentialDecision(resolvedCredential.status === "REVOKED");
      await recordGymAccessDecision(tx, {
        tenantId: input.tenantId,
        actorId: input.actorId,
        decision,
        memberId: resolvedCredential.memberId,
        credentialId: resolvedCredential.credential?.id,
        identifierFingerprint: resolvedCredential.fingerprint,
        occurredAt: now,
      });
      return { decision, visit: null };
    }

    const memberId = resolvedCredential?.memberId ?? input.memberId;
    if (!memberId) throw new Error("MEMBER_NOT_FOUND");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.tenantId}:${memberId}`}))`;

    const decision = await evaluateGymAccess(tx, {
      tenantId: input.tenantId,
      memberId,
      settings: input.settings,
      overrideReason: input.overrideReason,
      actorId: input.actorId,
      activatePending: true,
      now,
    });
    await recordGymAccessDecision(tx, {
      tenantId: input.tenantId,
      actorId: input.actorId,
      decision,
      memberId,
      credentialId: resolvedCredential?.credential.id,
      overrideReason: input.overrideReason,
      occurredAt: now,
    });
    if (!decision.allowed || !decision.entitlement || !decision.member) {
      return { decision, visit: null };
    }

    if (decision.unitsDelta < 0) {
      const debit = await tx.subscriptionEntitlement.updateMany({
        where: {
          id: decision.entitlement.id,
          tenantId: input.tenantId,
          remainingUnits: { gte: Math.abs(decision.unitsDelta) },
        },
        data: { remainingUnits: { decrement: Math.abs(decision.unitsDelta) } },
      });
      if (debit.count !== 1) throw new Error("GYM_QUOTA_RACE");
    }

    const visit = await tx.gymVisit.create({
      data: {
        tenantId: input.tenantId,
        memberId: decision.member.id,
        memberSubscriptionId: decision.entitlement.memberSubscriptionId,
        subscriptionEntitlementId: decision.entitlement.id,
        entryType: "CHECK_IN",
        unitsDelta: decision.unitsDelta,
        checkedById: input.actorId,
        overrideReason: decision.override ? input.overrideReason : null,
        checkedAt: now,
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        action: "GYM_CHECK_IN_CREATED",
        entityType: "GymVisit",
        entityId: visit.id,
        userId: input.actorId,
        details: JSON.stringify({
          memberId: decision.member.id,
          subscriptionId: decision.entitlement.memberSubscriptionId,
          entitlementId: decision.entitlement.id,
          unitsDelta: decision.unitsDelta,
          override: decision.override,
          overrideReason: input.overrideReason ?? null,
          credentialId: resolvedCredential?.credential.id ?? null,
        }),
      },
    });
    return { decision, visit };
  });
}
