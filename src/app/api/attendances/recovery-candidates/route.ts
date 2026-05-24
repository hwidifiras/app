import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { listRecoveryCandidatesForSession } from "@/lib/attendance-rules";
import { requireAuth } from "@/lib/request-user";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const sessionId = new URL(request.url).searchParams.get("sessionId")?.trim();

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId requis" }, { status: 400 });
  }

  const candidates = await listRecoveryCandidatesForSession(sessionId);

  return NextResponse.json({ data: candidates });
}
