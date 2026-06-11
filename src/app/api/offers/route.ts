import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { createOfferSchema, parseOfferRules } from "@/lib/schemas/offer";
import { validateStaffOfferDiscount } from "@/lib/membership-rules";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "offers.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const offers = await prisma.offer.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    data: offers.map((o) => ({
      ...o,
      rules: JSON.parse(o.rules) as Record<string, unknown>,
    })),
  });
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "offers.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = createOfferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation échouée", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    parseOfferRules(parsed.data.kind, parsed.data.rules);
  } catch {
    return NextResponse.json({ error: "Règles d'offre invalides" }, { status: 400 });
  }

  if (parsed.data.kind === "PERCENT_OFF" || parsed.data.kind === "SECOND_DISCIPLINE") {
    const percent =
      (parsed.data.rules as { percentOff?: number }).percentOff ?? 0;
    const check = await validateStaffOfferDiscount(actor.role, percent);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }
  }

  try {
    const offer = await prisma.offer.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        kind: parsed.data.kind,
        isActive: parsed.data.isActive ?? true,
        rules: JSON.stringify(parsed.data.rules),
        createdById: actor.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "OFFER_CREATED",
        entityType: "Offer",
        entityId: offer.id,
        userId: actor.id,
        details: JSON.stringify({ kind: offer.kind, name: offer.name }),
      },
    });

    return NextResponse.json(
      {
        data: { ...offer, rules: parsed.data.rules },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Erreur création offre" }, { status: 500 });
  }
}
