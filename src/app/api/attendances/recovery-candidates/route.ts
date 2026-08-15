import { NextResponse } from "next/server";

import { listRecoveryCandidatesForSession } from "@/lib/attendance-rules";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { coachSessionWhere } from "@/modules/classes/coach-scope";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "class.attendance");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const sessionId = new URL(request.url).searchParams.get("sessionId")?.trim();

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId requis" }, { status: 400 });
  }

  const session = await prisma.session.findFirst({
    where: { id: sessionId, tenantId: actor.tenantId, ...coachSessionWhere(actor) },
    select: { id: true },
  });
  if (!session) {
    return NextResponse.json({ error: "SÃ©ance introuvable" }, { status: 404 });
  }

  const candidates = await listRecoveryCandidatesForSession(sessionId);

  return NextResponse.json({ data: candidates });
}
