import { NextResponse } from "next/server";

import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireTenantModule, tenantModuleErrorResponse } from "@/lib/tenant-modules";
import { getGymReportSnapshot, parseGymReportRange } from "@/modules/gym/gym-report";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "gym.manage");
    await requireTenantModule(actor.tenantId, "GYM_ACCESS");
  } catch (error) {
    if (error instanceof Error && error.message === "MODULE_DISABLED") {
      const failure = tenantModuleErrorResponse(error);
      return NextResponse.json({ error: failure.error }, { status: failure.status });
    }
    return jsonAuthFailureResponse(error);
  }

  const range = parseGymReportRange(new URL(request.url).searchParams);
  const data = await getGymReportSnapshot(prisma, { tenantId: actor.tenantId, range });
  return NextResponse.json({ data: { ...data, from: range.from.toISOString(), to: range.to.toISOString() } });
}
