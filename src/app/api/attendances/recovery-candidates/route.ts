import { NextResponse } from "next/server";

import { listRecoveryCandidatesForSession } from "@/lib/attendance-rules";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "attendance.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const sessionId = new URL(request.url).searchParams.get("sessionId")?.trim();

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId requis" }, { status: 400 });
  }

  const candidates = await listRecoveryCandidatesForSession(sessionId);

  return NextResponse.json({ data: candidates });
}
