import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createSportSchema, updateSportSchema } from "@/lib/schemas/sport";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { listSportOverviews } from "@/lib/sports-overview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SportAuditSnapshot = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

function sportAuditSnapshot(sport: SportAuditSnapshot) {
  return {
    id: sport.id,
    name: sport.name,
    description: sport.description,
    isActive: sport.isActive,
  };
}

export async function GET(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "class.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const active = searchParams.get("active");

  const sports = await listSportOverviews({
    active: active === "true",
    query,
    tenantId: actor.tenantId,
  });

  return NextResponse.json({ data: sports });
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "class.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = createSportSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const descriptionValue = parsed.data.description?.trim() || null;

  try {
    const sport = await prisma.$transaction(async (tx) => {
      const created = await tx.sport.create({
        data: {
          tenantId: actor.tenantId,
          name: parsed.data.name,
          description: descriptionValue,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "SPORT_CREATED",
          entityType: "Sport",
          entityId: created.id,
          userId: actor.id,
          details: JSON.stringify({ after: sportAuditSnapshot(created) }),
        },
      });

      return created;
    });

    return NextResponse.json({ data: sport }, { status: 201 });
  } catch (error) {
    const isDuplicateName =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

    const message = isDuplicateName
      ? "Un sport avec ce nom existe déjà"
      : "Erreur serveur lors de la création du sport";

    return NextResponse.json({ error: message }, { status: isDuplicateName ? 409 : 500 });
  }
}

export async function PATCH(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "class.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("sportId" in body)) {
    return NextResponse.json({ error: "sportId requis" }, { status: 400 });
  }

  const sportId = (body as { sportId?: unknown }).sportId;

  if (typeof sportId !== "string" || sportId.trim().length === 0) {
    return NextResponse.json({ error: "sportId invalide" }, { status: 400 });
  }

  const updatePayload = updateSportSchema.safeParse((body as Record<string, unknown>).payload);

  if (!updatePayload.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: updatePayload.error.flatten(),
      },
      { status: 400 },
    );
  }

  const payload = updatePayload.data;

  try {
    const current = await prisma.sport.findFirst({ where: { id: sportId, tenantId: actor.tenantId } });
    if (!current) {
      return NextResponse.json({ error: "Sport introuvable" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.sport.update({
        where: { id: sportId },
        data: {
          name: payload.name,
          description:
            payload.description === undefined
              ? undefined
              : payload.description === "" || payload.description === null
                ? null
                : payload.description,
          isActive: payload.isActive,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "SPORT_UPDATED",
          entityType: "Sport",
          entityId: sportId,
          userId: actor.id,
          details: JSON.stringify({
            before: sportAuditSnapshot(current),
            after: sportAuditSnapshot(next),
          }),
        },
      });

      return next;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    const isDuplicateName =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025";

    if (isNotFound) {
      return NextResponse.json({ error: "Sport introuvable" }, { status: 404 });
    }

    if (isDuplicateName) {
      return NextResponse.json({ error: "Un sport avec ce nom existe déjà" }, { status: 409 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de la modification" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "class.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("sportId" in body)) {
    return NextResponse.json({ error: "sportId requis" }, { status: 400 });
  }

  const sportId = (body as { sportId?: unknown }).sportId;

  if (typeof sportId !== "string" || sportId.trim().length === 0) {
    return NextResponse.json({ error: "sportId invalide" }, { status: 400 });
  }

  const [linkedGroups, linkedPlans, linkedSubscriptions] = await Promise.all([
    prisma.group.findMany({
      where: { tenantId: actor.tenantId, sportId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.subscriptionPlan.findMany({
      where: { tenantId: actor.tenantId, sportId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.memberSubscription.findMany({
      where: { tenantId: actor.tenantId, sportId },
      select: {
        id: true,
        member: { select: { firstName: true, lastName: true } },
        plan: { select: { name: true } },
      },
      take: 20,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (linkedGroups.length > 0 || linkedPlans.length > 0 || linkedSubscriptions.length > 0) {
    const parts: string[] = [];
    if (linkedGroups.length > 0) parts.push(`${linkedGroups.length} cours`);
    if (linkedPlans.length > 0) parts.push(`${linkedPlans.length} formule(s)`);
    if (linkedSubscriptions.length > 0) parts.push(`${linkedSubscriptions.length} abonnement(s)`);

    return NextResponse.json(
      {
        error: `Cette discipline est encore utilisée (${parts.join(", ")}). Désactivez-la ou supprimez les éléments liés d'abord.`,
        details: {
          groups: linkedGroups,
          plans: linkedPlans,
          subscriptions: linkedSubscriptions.map((s) => ({
            id: s.id,
            label: `${s.member.firstName} ${s.member.lastName} — ${s.plan.name}`,
          })),
        },
      },
      { status: 409 },
    );
  }

  try {
    const deactivated = await prisma.sport.update({
      where: { id: sportId },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        action: "SPORT_DEACTIVATED",
        entityType: "Sport",
        entityId: sportId,
        userId: actor.id,
        details: JSON.stringify({ name: deactivated.name }),
      },
    });

    return NextResponse.json({ data: deactivated });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? (error as { code?: string }).code
        : undefined;

    if (code === "P2025") {
      return NextResponse.json({ error: "Discipline introuvable" }, { status: 404 });
    }

    if (code === "P2003") {
      return NextResponse.json(
        {
          error:
            "Impossible de supprimer : cette discipline est encore référencée (cours, formules ou abonnements).",
        },
        { status: 409 },
      );
    }

    console.error("[DELETE /api/sports]", error);
    return NextResponse.json({ error: "Erreur serveur lors de la desactivation" }, { status: 500 });
  }
}
