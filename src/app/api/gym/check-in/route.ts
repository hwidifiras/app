import { NextResponse } from "next/server";

import { getClubSettings } from "@/lib/club-settings";
import { evaluateGymAccessBatch } from "@/lib/gym-access-policy";
import { prisma } from "@/lib/prisma";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { gymCheckInSchema } from "@/lib/schemas/gym";
import { requireTenantModule, tenantModuleErrorResponse } from "@/lib/tenant-modules";
import { recordGymCheckIn } from "@/modules/gym/check-in-service";

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
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (!["UNAUTHENTICATED", "FORBIDDEN"].includes(code)) {
      console.error("[GET /api/gym/check-in authorize]", error);
    }
    return jsonAuthFailureResponse(error);
  }

  const query = new URL(request.url).searchParams.get("query")?.trim().slice(0, 100) ?? "";
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
  const data = await prisma.$transaction((tx) => evaluateGymAccessBatch(tx, {
    tenantId: actor.tenantId,
    memberIds: members.map((member) => member.id),
    settings,
  }));
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
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (!["UNAUTHENTICATED", "FORBIDDEN"].includes(code)) {
      console.error("[POST /api/gym/check-in authorize]", error);
    }
    return jsonAuthFailureResponse(error);
  }

  const parsed = gymCheckInSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation echouee", details: parsed.error.flatten() }, { status: 400 });
  }
  const settings = await getClubSettings({ tenantId: actor.tenantId });

  try {
    const result = await recordGymCheckIn(prisma, {
      tenantId: actor.tenantId,
      actorId: actor.id,
      settings,
      memberId: parsed.data.memberId,
      credentialCode: parsed.data.credentialCode,
      overrideReason: parsed.data.overrideReason,
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
    if (error instanceof Error && error.message === "MEMBER_NOT_FOUND") {
      return NextResponse.json({ error: "Membre introuvable", code: "MEMBER_NOT_FOUND" }, { status: 404 });
    }
    console.error("[POST /api/gym/check-in]", error);
    return NextResponse.json({ error: "Enregistrement du passage impossible" }, { status: 500 });
  }
}
