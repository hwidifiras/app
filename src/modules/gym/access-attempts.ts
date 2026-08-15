import type { Prisma } from "@prisma/client";

import type { GymAccessDecision } from "@/lib/gym-access-policy";

export async function recordGymAccessDecision(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    actorId: string;
    decision: GymAccessDecision;
    credentialId?: string | null;
    memberId?: string | null;
    identifierFingerprint?: string | null;
    overrideReason?: string | null;
    occurredAt?: Date;
  },
) {
  if (input.decision.allowed && !input.decision.override) return null;
  const outcome = input.decision.override ? "EXCEPTIONAL_ALLOWED" : "DENIED";
  return tx.gymAccessAttempt.create({
    data: {
      tenantId: input.tenantId,
      memberId: input.decision.member?.id ?? input.memberId ?? null,
      credentialId: input.credentialId ?? null,
      outcome,
      failureCode: input.decision.code ?? (outcome === "DENIED" ? "ACCESS_DENIED" : null),
      identifierFingerprint: input.identifierFingerprint ?? null,
      overrideReason: outcome === "EXCEPTIONAL_ALLOWED" ? input.overrideReason?.trim() : null,
      checkedById: input.actorId,
      occurredAt: input.occurredAt ?? new Date(),
    },
  });
}
