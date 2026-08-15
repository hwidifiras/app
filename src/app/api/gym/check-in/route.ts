import { NextResponse } from "next/server";

import { getClubSettings } from "@/lib/club-settings";
import { evaluateGymAccess } from "@/lib/gym-access-policy";
import { prisma } from "@/lib/prisma";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { gymCheckInSchema } from "@/lib/schemas/gym";
import { requireTenantModule, tenantModuleErrorResponse } from "@/lib/tenant-modules";

export const runtime = "nodejs";

async function authorize(request: Request) {
  const actor = await requirePermission(request, "gym.checkin");
  await requireTenantModule(actor.tenantId, "GYM_ACCESS");
  return actor;
}

export async function GET(request: Request) {
  let actor;
  try {
    actor = await authorize(request);
  } catch (error) {
    if (error instanceof Error && error.message === "MODULE_DISABLED") {
      const failure = tenantModuleErrorResponse(error);
      return NextResponse.json({ error: failure.error }, { status: failure.status });
    }
    return jsonAuthFailureResponse(error);
  }

  const query = new URL(request.url).searchParams.get("query")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ data: [] });

  const members = await prisma.member.findMany({
    where: {
      tenantId: actor.tenantId,
      status: "ACTIVE",
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
      ],
    },
    select: { id: true },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    take: 10,
  });
  const settings = await getClubSettings({ tenantId: actor.tenantId });
  const data = [];
  for (const member of members) {
    const decision = await prisma.$transaction((tx) =>
      evaluateGymAccess(tx, { tenantId: actor.tenantId, memberId: member.id, settings }),
    );
    data.push(decision);
  }
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await authorize(request);
  } catch (error) {
    if (error instanceof Error && error.message === "MODULE_DISABLED") {
      const failure = tenantModuleErrorResponse(error);
      return NextResponse.json({ error: failure.error }, { status: failure.status });
    }
    return jsonAuthFailureResponse(error);
  }

  const parsed = gymCheckInSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation echouee", details: parsed.error.flatten() }, { status: 400 });
  }
  const settings = await getClubSettings({ tenantId: actor.tenantId });

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${actor.tenantId}:${parsed.data.memberId}`}))`;
      const decision = await evaluateGymAccess(tx, {
        tenantId: actor.tenantId,
        memberId: parsed.data.memberId,
        settings,
        overrideReason: parsed.data.overrideReason,
      });
      if (!decision.allowed || !decision.entitlement || !decision.member) {
        return { decision, visit: null };
      }

      if (decision.unitsDelta < 0) {
        const debit = await tx.subscriptionEntitlement.updateMany({
          where: {
            id: decision.entitlement.id,
            tenantId: actor.tenantId,
            remainingUnits: { gte: Math.abs(decision.unitsDelta) },
          },
          data: { remainingUnits: { decrement: Math.abs(decision.unitsDelta) } },
        });
        if (debit.count !== 1) throw new Error("GYM_QUOTA_RACE");
      }

      const visit = await tx.gymVisit.create({
        data: {
          tenantId: actor.tenantId,
          memberId: decision.member.id,
          memberSubscriptionId: decision.entitlement.memberSubscriptionId,
          subscriptionEntitlementId: decision.entitlement.id,
          entryType: "CHECK_IN",
          unitsDelta: decision.unitsDelta,
          checkedById: actor.id,
          overrideReason: decision.override ? parsed.data.overrideReason : null,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "GYM_CHECK_IN_CREATED",
          entityType: "GymVisit",
          entityId: visit.id,
          userId: actor.id,
          details: JSON.stringify({
            memberId: decision.member.id,
            subscriptionId: decision.entitlement.memberSubscriptionId,
            entitlementId: decision.entitlement.id,
            unitsDelta: decision.unitsDelta,
            override: decision.override,
            overrideReason: parsed.data.overrideReason ?? null,
          }),
        },
      });
      return { decision, visit };
    });

    if (!result.visit) {
      return NextResponse.json(
        { error: result.decision.message, code: result.decision.code, data: result.decision },
        { status: result.decision.code === "MEMBER_NOT_FOUND" ? 404 : 403 },
      );
    }
    return NextResponse.json({ data: { visit: result.visit, access: result.decision } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "GYM_QUOTA_RACE") {
      return NextResponse.json({ error: "Quota de visites epuise", code: "PASS_EXHAUSTED" }, { status: 409 });
    }
    console.error("[POST /api/gym/check-in]", error);
    return NextResponse.json({ error: "Enregistrement du passage impossible" }, { status: 500 });
  }
}
