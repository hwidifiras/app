import { NextResponse } from "next/server";

import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { enrollmentQuoteSchema } from "@/lib/schemas/enrollment";
import { buildEnrollmentQuote } from "@/lib/membership-rules";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await requirePermission(request, "enrollment.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = enrollmentQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation échouée", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const quote = await buildEnrollmentQuote(
      parsed.data.lines,
      parsed.data.offerId,
      parsed.data.startDate,
    );
    return NextResponse.json({ data: quote });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("PLAN_SPORT_MISMATCH")) {
      return NextResponse.json({ error: "Le plan ne correspond pas à la discipline du cours" }, { status: 409 });
    }
    if (msg.includes("MEMBER_TYPE_MISMATCH")) {
      return NextResponse.json({ error: "Type d'élève incompatible avec ce cours" }, { status: 409 });
    }
    if (msg.includes("MEMBER_ARCHIVED")) {
      return NextResponse.json({ error: "Impossible d'inscrire un élève archivé" }, { status: 409 });
    }
    if (msg.includes("MEMBER_NOT_FOUND")) {
      return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
    }
    if (msg.includes("GROUP_INVALID")) {
      return NextResponse.json({ error: "Cours invalide ou inactif" }, { status: 404 });
    }
    console.error("[POST /api/enrollment/quote]", error);
    return NextResponse.json({ error: "Erreur lors du devis" }, { status: 500 });
  }
}
