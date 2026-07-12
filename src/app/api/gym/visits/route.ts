import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { gymVisitReversalSchema } from "@/lib/schemas/gym";
import { requireTenantModule, tenantModuleErrorResponse } from "@/lib/tenant-modules";

export const runtime = "nodejs";

async function authorize(request: Request) {
  const actor = await requirePermission(request, "gym.manage");
  await requireTenantModule(actor.tenantId, "GYM");
  return actor;
}

function authFailure(error: unknown) {
  if (error instanceof Error && error.message === "MODULE_DISABLED") {
    const failure = tenantModuleErrorResponse(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return jsonAuthFailureResponse(error);
}

export async function GET(request: Request) {
  let actor;
  try {
    actor = await authorize(request);
  } catch (error) {
    return authFailure(error);
  }

  const params = new URL(request.url).searchParams;
  const memberId = params.get("memberId")?.trim();
  const from = params.get("from") ? new Date(params.get("from") as string) : null;
  const to = params.get("to") ? new Date(params.get("to") as string) : null;
  const visits = await prisma.gymVisit.findMany({
    where: {
      tenantId: actor.tenantId,
      ...(memberId ? { memberId } : {}),
      ...(from && !Number.isNaN(from.getTime()) ? { checkedAt: { gte: from, ...(to && !Number.isNaN(to.getTime()) ? { lt: to } : {}) } } : {}),
    },
    include: {
      member: { select: { firstName: true, lastName: true, phone: true } },
      checkedBy: { select: { name: true } },
      memberSubscription: { select: { plan: { select: { name: true } } } },
      subscriptionEntitlement: { select: { gymAccessMode: true, remainingUnits: true } },
      corrections: { select: { id: true, correctionReason: true, checkedAt: true } },
    },
    orderBy: { checkedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ data: visits });
}

export async function PATCH(request: Request) {
  let actor;
  try {
    actor = await authorize(request);
  } catch (error) {
    return authFailure(error);
  }
  const parsed = gymVisitReversalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Motif de correction requis", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const reversal = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${actor.tenantId}:${parsed.data.visitId}`}))`;
      const original = await tx.gymVisit.findFirst({
        where: { id: parsed.data.visitId, tenantId: actor.tenantId, entryType: "CHECK_IN" },
        include: { corrections: { where: { entryType: "REVERSAL" }, select: { id: true } } },
      });
      if (!original) throw new Error("VISIT_NOT_FOUND");
      if (original.corrections.length > 0) throw new Error("VISIT_ALREADY_REVERSED");

      const restoreUnits = Math.max(0, -original.unitsDelta);
      if (restoreUnits > 0) {
        const restored = await tx.subscriptionEntitlement.updateMany({
          where: { id: original.subscriptionEntitlementId, tenantId: actor.tenantId },
          data: { remainingUnits: { increment: restoreUnits } },
        });
        if (restored.count !== 1) throw new Error("ENTITLEMENT_SCOPE_MISMATCH");
      }
      const created = await tx.gymVisit.create({
        data: {
          tenantId: actor.tenantId,
          memberId: original.memberId,
          memberSubscriptionId: original.memberSubscriptionId,
          subscriptionEntitlementId: original.subscriptionEntitlementId,
          entryType: "REVERSAL",
          correctsVisitId: original.id,
          unitsDelta: restoreUnits,
          checkedById: actor.id,
          correctionReason: parsed.data.reason,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "GYM_CHECK_IN_REVERSED",
          entityType: "GymVisit",
          entityId: created.id,
          userId: actor.id,
          details: JSON.stringify({ originalVisitId: original.id, reason: parsed.data.reason, restoredUnits: restoreUnits }),
        },
      });
      return created;
    });
    return NextResponse.json({ data: reversal });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "VISIT_NOT_FOUND") return NextResponse.json({ error: "Passage introuvable" }, { status: 404 });
    if (code === "VISIT_ALREADY_REVERSED") return NextResponse.json({ error: "Passage deja annule" }, { status: 409 });
    console.error("[PATCH /api/gym/visits]", error);
    return NextResponse.json({ error: "Correction impossible" }, { status: 500 });
  }
}
