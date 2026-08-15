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
import { getTenantProductContext } from "@/platform/product/product-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "plans.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }
  const product = await getTenantProductContext(actor.tenantId);
  const visibleScopes = product.profile === "CLASS_ONLY"
    ? ["ALL" as const, "CLASS" as const]
    : product.profile === "GYM_ONLY"
      ? ["ALL" as const, "GYM" as const]
      : ["ALL" as const, "CLASS" as const, "GYM" as const, "MIXED" as const];

  const offers = await prisma.offer.findMany({
    where: { tenantId: actor.tenantId, isActive: true, planScope: { in: visibleScopes } },
    orderBy: { createdAt: "desc" },
    include: {
      sport: { select: { id: true, name: true } },
      _count: { select: { applications: true } },
    },
  });

  return NextResponse.json({
    data: offers.map((offer) => ({
      ...offer,
      sportName: offer.sport?.name ?? null,
      applicationsCount: offer._count.applications,
      rules: offerToRulesRecord(offer),
    })),
  });
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "plans.manage");
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
  const product = await getTenantProductContext(actor.tenantId);
  const scopeEnabled = parsed.data.planScope === "ALL"
    || (parsed.data.planScope === "CLASS" && product.capabilities.classManagement)
    || (parsed.data.planScope === "GYM" && product.capabilities.gymAccess)
    || (parsed.data.planScope === "MIXED" && product.capabilities.mixedSales);
  if (!scopeEnabled || (parsed.data.kind === "SECOND_DISCIPLINE" && !product.capabilities.classManagement)) {
    return NextResponse.json({ error: "Cette offre cible un module non actif" }, { status: 403 });
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
      where: { id: structured.sportId, tenantId: actor.tenantId, isActive: true },
      select: { id: true },
    });
    if (!sport) {
      return NextResponse.json({ error: "Discipline introuvable ou inactive" }, { status: 400 });
    }
  }

  try {
    const offer = await prisma.offer.create({
      data: {
        tenantId: actor.tenantId,
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        kind: parsed.data.kind,
        planScope: parsed.data.planScope,
        isActive: parsed.data.isActive ?? true,
        rules: serializeOfferRules(resolvedRules),
        ...structured,
        createdById: actor.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        action: "OFFER_CREATED",
        entityType: "Offer",
        entityId: offer.id,
        userId: actor.id,
        details: JSON.stringify({ tenantId: actor.tenantId, kind: offer.kind, name: offer.name }),
      },
    });

    return NextResponse.json(
      {
        data: {
          ...offer,
          sportName: structured.sportId
            ? (
                await prisma.sport.findFirst({
                  where: { id: structured.sportId, tenantId: actor.tenantId },
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
    actor = await requirePermission(request, "plans.manage");
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

  const offer = await prisma.offer.findFirst({
    where: { id: offerId, tenantId: actor.tenantId },
    select: {
      id: true,
      name: true,
      kind: true,
      isActive: true,
      _count: { select: { applications: true } },
    },
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
      tenantId: actor.tenantId,
      action: "OFFER_DEACTIVATED",
      entityType: "Offer",
      entityId: offer.id,
      userId: actor.id,
      details: JSON.stringify({
        tenantId: actor.tenantId,
        kind: offer.kind,
        name: offer.name,
        applicationsCount: offer._count.applications,
      }),
    },
  });

  return NextResponse.json({ data: archived });
}
