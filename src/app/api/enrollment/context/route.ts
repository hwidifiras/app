import { NextResponse } from "next/server";

import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import {
  ENROLLMENT_TYPES,
  EnrollmentContextUnavailableError,
  loadEnrollmentContext,
  type EnrollmentType,
} from "@/modules/sales/enrollment-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "enrollment.sell");
  } catch (error) {
    return jsonAuthFailureResponse(error);
  }

  const requestedType = new URL(request.url).searchParams.get("type") ?? "class";
  if (!ENROLLMENT_TYPES.includes(requestedType as EnrollmentType)) {
    return NextResponse.json({ error: "Type d'inscription invalide" }, { status: 400 });
  }

  try {
    const data = await loadEnrollmentContext({
      tenantId: actor.tenantId,
      type: requestedType as EnrollmentType,
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof EnrollmentContextUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[GET /api/enrollment/context]", error);
    return NextResponse.json({ error: "Impossible de charger le contexte d'inscription" }, { status: 500 });
  }
}
