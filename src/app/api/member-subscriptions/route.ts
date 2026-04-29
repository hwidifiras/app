import { NextResponse } from "next/server";
import type { SubscriptionStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  createMemberSubscriptionSchema,
  updateMemberSubscriptionSchema,
} from "@/lib/schemas/member-subscription";

export const runtime = "nodejs";

const VALID_STATUSES: string[] = ["ACTIVE", "EXPIRED", "CANCELLED", "DRAFT"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId")?.trim();
  const planId = searchParams.get("planId")?.trim();
  const statusRaw = searchParams.get("status")?.trim();
  const status = statusRaw && VALID_STATUSES.includes(statusRaw) ? (statusRaw as SubscriptionStatus) : undefined;

  const subscriptions = await prisma.memberSubscription.findMany({
    where: {
      ...(memberId ? { memberId } : {}),
      ...(planId ? { planId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      member: { select: { id: true, firstName: true, lastName: true, phone: true } },
      plan: { select: { id: true, name: true, price: true, totalSessions: true, sessionsPerWeek: true, validityDays: true } },
      payments: { select: { id: true, amount: true, paymentDate: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ data: subscriptions });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = createMemberSubscriptionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { memberId, planId, startDate, endDate, amount, remainingSessions, status } = parsed.data;

  try {
    const memberExists = await prisma.member.findUnique({ where: { id: memberId } });
    if (!memberExists) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
    }

    const subscription = await prisma.memberSubscription.create({
      data: {
        memberId,
        planId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        amount,
        remainingSessions: remainingSessions ?? plan.totalSessions,
        status,
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        plan: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: subscription }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/member-subscriptions] error:", error);
    return NextResponse.json({ error: "Erreur serveur lors de la création de l'abonnement" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("subscriptionId" in body)) {
    return NextResponse.json({ error: "subscriptionId requis" }, { status: 400 });
  }

  const subscriptionId = (body as { subscriptionId?: unknown }).subscriptionId;

  if (typeof subscriptionId !== "string" || subscriptionId.trim().length === 0) {
    return NextResponse.json({ error: "subscriptionId invalide" }, { status: 400 });
  }

  const updatePayload = updateMemberSubscriptionSchema.safeParse((body as Record<string, unknown>).payload);

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
    if (payload.planId) {
      const planExists = await prisma.subscriptionPlan.findUnique({ where: { id: payload.planId } });
      if (!planExists) {
        return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
      }
    }

    const updated = await prisma.memberSubscription.update({
      where: { id: subscriptionId },
      data: {
        planId: payload.planId,
        startDate: payload.startDate ? new Date(payload.startDate) : undefined,
        endDate: payload.endDate === null ? null : payload.endDate ? new Date(payload.endDate) : undefined,
        amount: payload.amount,
        status: payload.status,
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        plan: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025";

    if (isNotFound) {
      return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 });
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

  if (typeof body !== "object" || body === null || !("subscriptionId" in body)) {
    return NextResponse.json({ error: "subscriptionId requis" }, { status: 400 });
  }

  const subscriptionId = (body as { subscriptionId?: unknown }).subscriptionId;

  if (typeof subscriptionId !== "string" || subscriptionId.trim().length === 0) {
    return NextResponse.json({ error: "subscriptionId invalide" }, { status: 400 });
  }

  try {
    await prisma.memberSubscription.delete({
      where: { id: subscriptionId },
    });

    return NextResponse.json({ data: { id: subscriptionId } });
  } catch (error) {
    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025";

    if (isNotFound) {
      return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de la suppression" }, { status: 500 });
  }
}
