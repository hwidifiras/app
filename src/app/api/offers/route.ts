import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import {
  buildCreateOfferRules,
  offerToRulesRecord,
  serializeOfferRules,
  structuredFieldsFromParsedRules,
} from "@/lib/offer-rules";
import { createOfferSchema } from "@/lib/schemas/offer";
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
    include: {
      sport: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    data: offers.map((offer) => ({
      ...offer,
      sportName: offer.sport?.name ?? null,
      rules: offerToRulesRecord(offer),
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

  let resolvedRules;
  try {
    resolvedRules = buildCreateOfferRules(parsed.data);
  } catch {
    return NextResponse.json({ error: "Règles d'offre invalides" }, { status: 400 });
  }

  if (parsed.data.kind === "PERCENT_OFF" || parsed.data.kind === "SECOND_DISCIPLINE") {
    const percent = (resolvedRules as { percentOff: number }).percentOff;
    const check = await validateStaffOfferDiscount(actor.role, percent);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 403 });
    }
  }

  const structured = structuredFieldsFromParsedRules(parsed.data.kind, resolvedRules);

  if (structured.sportId) {
    const sport = await prisma.sport.findFirst({
      where: { id: structured.sportId, isActive: true },
      select: { id: true },
    });
    if (!sport) {
      return NextResponse.json({ error: "Discipline introuvable ou inactive" }, { status: 400 });
    }
  }

  try {
    const offer = await prisma.offer.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        kind: parsed.data.kind,
        isActive: parsed.data.isActive ?? true,
        rules: serializeOfferRules(resolvedRules),
        ...structured,
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
        data: {
          ...offer,
          sportName: structured.sportId
            ? (
                await prisma.sport.findUnique({
                  where: { id: structured.sportId },
                  select: { name: true },
                })
              )?.name ?? null
            : null,
          rules: resolvedRules,
        },
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Erreur création offre" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
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

  const offerId =
    typeof body === "object" && body !== null && "offerId" in body
      ? String((body as { offerId: unknown }).offerId).trim()
      : "";

  if (!offerId) {
    return NextResponse.json({ error: "Offre requise" }, { status: 400 });
  }

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, name: true, kind: true, isActive: true },
  });

  if (!offer) {
    return NextResponse.json({ error: "Offre introuvable" }, { status: 404 });
  }

  if (!offer.isActive) {
    return NextResponse.json({ data: offer });
  }

  const archived = await prisma.offer.update({
    where: { id: offerId },
    data: { isActive: false },
  });

  await prisma.auditLog.create({
    data: {
      action: "OFFER_DEACTIVATED",
      entityType: "Offer",
      entityId: offer.id,
      userId: actor.id,
      details: JSON.stringify({ kind: offer.kind, name: offer.name }),
    },
  });

  return NextResponse.json({ data: archived });
}
