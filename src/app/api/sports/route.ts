import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createSportSchema, updateSportSchema } from "@/lib/schemas/sport";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requirePermission(request, "catalog.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const active = searchParams.get("active");

  const sports = await prisma.sport.findMany({
    where: {
      ...(active === "true" ? { isActive: true } : {}),
      ...(query
        ? {
            OR: [{ name: { contains: query } }, { description: { contains: query } }],
          }
        : {}),
    },
    orderBy: query ? { createdAt: "desc" } : { name: "asc" },
    take: 50,
  });

  return NextResponse.json({ data: sports });
}

export async function POST(request: Request) {
  try {
    await requirePermission(request, "catalog.manage");
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
    const sport = await prisma.sport.create({
      data: {
        name: parsed.data.name,
        description: descriptionValue,
      },
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
  try {
    await requirePermission(request, "catalog.manage");
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
    const updated = await prisma.sport.update({
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
  try {
    await requirePermission(request, "catalog.manage");
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
      where: { sportId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.subscriptionPlan.findMany({
      where: { sportId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.memberSubscription.findMany({
      where: { sportId },
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
    await prisma.sport.delete({
      where: { id: sportId },
    });

    return NextResponse.json({ data: { id: sportId } });
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
    return NextResponse.json({ error: "Erreur serveur lors de la suppression" }, { status: 500 });
  }
}
