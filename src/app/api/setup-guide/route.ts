import { NextResponse } from "next/server";

import { getSetupGuideProgress } from "@/lib/setup-guide";
import { requireAuth } from "@/lib/request-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAuth(request);
  } catch (e) {
    const code = e instanceof Error ? e.message : "FORBIDDEN";
    return NextResponse.json(
      { error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé" },
      { status: code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }

  const progress = await getSetupGuideProgress();
  return NextResponse.json({ data: progress });
}
