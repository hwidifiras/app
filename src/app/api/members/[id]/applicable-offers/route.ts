import { NextResponse } from "next/server";

import { getMemberOfferContext } from "@/lib/offer-applicability";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let actor;
  try {
    actor = await requirePermission(_request, "members.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const { id } = await params;

  const member = await prisma.member.findFirst({
    where: { id, tenantId: actor.tenantId },
    select: { id: true },
  });

  if (!member) {
    return NextResponse.json({ error: "Élève introuvable" }, { status: 404 });
  }

  const context = await getMemberOfferContext(id, actor.tenantId);

  return NextResponse.json({ data: context });
}
