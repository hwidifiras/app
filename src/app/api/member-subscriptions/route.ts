import { NextResponse } from "next/server";
import type { SubscriptionStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  createMemberSubscriptionSchema,
  updateMemberSubscriptionSchema,
} from "@/lib/schemas/member-subscription";
import { requireAuth, requireAdmin } from "@/lib/request-user";
import {
  computeEndDate,
  expireActiveSubscriptionForSport,
  expireStaleSubscriptions,
} from "@/lib/membership-rules";

export const runtime = "nodejs";

const VALID_STATUSES: string[] = ["ACTIVE", "EXPIRED", "CANCELLED", "DRAFT"];

export async function GET(request: Request) {
  try {
    await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get("memberId")?.trim();
  const planId = searchParams.get("planId")?.trim();
  const sportId = searchParams.get("sportId")?.trim();
  const statusRaw = searchParams.get("status")?.trim();
  const status = statusRaw && VALID_STATUSES.includes(statusRaw) ? (statusRaw as SubscriptionStatus) : undefined;

  if (memberId) await expireStaleSubscriptions(memberId);

  const subscriptions = await prisma.memberSubscription.findMany({
    where: {
      ...(memberId ? { memberId } : {}),
      ...(planId ? { planId } : {}),
      ...(sportId ? { sportId } : {}),
      ...(status ? { status } : {}),
    },
    select: {
      id: true,
      memberId: true,
      planId: true,
      sportId: true,
      startDate: true,
      endDate: true,
      amount: true,
      remainingSessions: true,
      status: true,
      createdAt: true,
      member: { select: { id: true, firstName: true, lastName: true, phone: true } },
      plan: { select: { id: true, name: true, price: true, totalSessions: true, sessionsPerWeek: true, validityDays: true } },
      sport: { select: { id: true, name: true } },
      payments: { select: { id: true, amount: true, paymentDate: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ data: subscriptions });
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = createMemberSubscriptionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation échouée", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { memberId, planId, startDate } = parsed.data;
  const start = new Date(startDate);

  try {
    const memberExists = await prisma.member.findUnique({ where: { id: memberId } });
    if (!memberExists) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
    }

    if (plan.sportId) {
      const incompatibleGroup = await prisma.groupMember.findFirst({
        where: {
          memberId,
          status: "ACTIVE",
          group: { sportId: { not: plan.sportId } },
        },
        select: { group: { select: { name: true } } },
      });

      if (incompatibleGroup) {
        return NextResponse.json(
          { error: `Le plan n'est pas compatible avec le cours actif "${incompatibleGroup.group.name}"` },
          { status: 409 },
        );
      }
    }

    const endDate = computeEndDate(start, plan.validityDays);
    const amount = plan.price;
    const remainingSessions = plan.totalSessions;

    const subscription = await prisma.$transaction(async (tx) => {
      await expireActiveSubscriptionForSport(tx, memberId, plan.sportId);

      const created = await tx.memberSubscription.create({
        data: {
          memberId,
          planId,
          sportId: plan.sportId,
          startDate: start,
          endDate,
          amount,
          remainingSessions,
          status: "ACTIVE",
        },
        include: {
          member: { select: { id: true, firstName: true, lastName: true } },
          plan: { select: { id: true, name: true } },
          sport: { select: { id: true, name: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          action: "MEMBER_SUBSCRIPTION_CREATED",
          entityType: "MemberSubscription",
          entityId: created.id,
          userId: actor.id,
          details: JSON.stringify({
            memberId,
            planId,
            sportId: plan.sportId,
            amount,
            startDate: start.toISOString(),
          }),
        },
      });

      return created;
    });

    return NextResponse.json({ data: subscription }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/member-subscriptions] error:", error);
    return NextResponse.json({ error: "Erreur serveur lors de la création de l'abonnement" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let actor;
  try {
    actor = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

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
      { error: "Validation échouée", details: updatePayload.error.flatten() },
      { status: 400 },
    );
  }

  const payload = updatePayload.data;
  const sensitive =
    payload.amount !== undefined ||
    payload.remainingSessions !== undefined ||
    payload.status !== undefined;

  if (sensitive && actor.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Seul un administrateur peut modifier le montant, les séances ou le statut" },
      { status: 403 },
    );
  }

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
        remainingSessions: payload.remainingSessions,
        status: payload.status,
        ...(payload.planId
          ? {
              sportId: (
                await prisma.subscriptionPlan.findUnique({
                  where: { id: payload.planId },
                  select: { sportId: true },
                })
              )?.sportId,
            }
          : {}),
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        plan: { select: { id: true, name: true } },
        sport: { select: { id: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "MEMBER_SUBSCRIPTION_UPDATED",
        entityType: "MemberSubscription",
        entityId: subscriptionId,
        userId: actor.id,
        details: JSON.stringify({ payload }),
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
  try {
    await requireAdmin(request);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "FORBIDDEN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

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
    await prisma.memberSubscription.delete({ where: { id: subscriptionId } });
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
