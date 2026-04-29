import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
} from "@/lib/schemas/subscription-plan";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  const plans = await prisma.subscriptionPlan.findMany({
    where: query
      ? {
          OR: [{ name: { contains: query } }, { description: { contains: query } }],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ data: plans });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = createSubscriptionPlanSchema.safeParse(body);

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
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: parsed.data.name,
        description: descriptionValue,
        price: parsed.data.price,
        totalSessions: parsed.data.totalSessions,
        sessionsPerWeek: parsed.data.sessionsPerWeek ?? null,
        validityDays: parsed.data.validityDays,
      },
    });

    return NextResponse.json({ data: plan }, { status: 201 });
  } catch (error) {
    const isDuplicateName =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

    const message = isDuplicateName
      ? "Un plan avec ce nom existe déjà"
      : "Erreur serveur lors de la création du plan";

    return NextResponse.json({ error: message }, { status: isDuplicateName ? 409 : 500 });
  }
}

export async function PATCH(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("planId" in body)) {
    return NextResponse.json({ error: "planId requis" }, { status: 400 });
  }

  const planId = (body as { planId?: unknown }).planId;

  if (typeof planId !== "string" || planId.trim().length === 0) {
    return NextResponse.json({ error: "planId invalide" }, { status: 400 });
  }

  const updatePayload = updateSubscriptionPlanSchema.safeParse((body as Record<string, unknown>).payload);

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
    const updated = await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: {
        name: payload.name,
        description:
          payload.description === undefined
            ? undefined
            : payload.description === "" || payload.description === null
              ? null
              : payload.description,
        price: payload.price,
        totalSessions: payload.totalSessions,
        sessionsPerWeek: payload.sessionsPerWeek,
        validityDays: payload.validityDays,
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
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
    }

    if (isDuplicateName) {
      return NextResponse.json({ error: "Un plan avec ce nom existe déjà" }, { status: 409 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de la modification" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("planId" in body)) {
    return NextResponse.json({ error: "planId requis" }, { status: 400 });
  }

  const planId = (body as { planId?: unknown }).planId;

  if (typeof planId !== "string" || planId.trim().length === 0) {
    return NextResponse.json({ error: "planId invalide" }, { status: 400 });
  }

  try {
    await prisma.subscriptionPlan.delete({
      where: { id: planId },
    });

    return NextResponse.json({ data: { id: planId } });
  } catch (error) {
    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025";

    if (isNotFound) {
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de la suppression" }, { status: 500 });
  }
}
