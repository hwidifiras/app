import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  createSubscriptionPlanSchema,
  updateSubscriptionPlanSchema,
} from "@/lib/schemas/subscription-plan";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { validatePlanSessionsPerWeekForSport } from "@/lib/sport-weekly-standard";
import { isTenantModuleEnabled } from "@/lib/tenant-modules";

export const runtime = "nodejs";

type SubscriptionPlanAuditSnapshot = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  totalSessions: number;
  sessionsPerWeek: number | null;
  validityDays: number;
  isActive: boolean;
  sportId: string | null;
  planKind: "CLASS" | "GYM" | "MIXED";
  sport?: { name: string } | null;
};

function planAuditSnapshot(plan: SubscriptionPlanAuditSnapshot) {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    price: plan.price,
    totalSessions: plan.totalSessions,
    sessionsPerWeek: plan.sessionsPerWeek,
    validityDays: plan.validityDays,
    isActive: plan.isActive,
    sportId: plan.sportId,
    sportName: plan.sport?.name ?? null,
    planKind: plan.planKind,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  let actor;

  try {
    actor = await requirePermission(request, "catalog.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const plans = await prisma.subscriptionPlan.findMany({
    where: query
      ? {
          tenantId: actor.tenantId,
          OR: [{ name: { contains: query } }, { description: { contains: query } }],
        }
      : { tenantId: actor.tenantId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      sport: { select: { id: true, name: true } },
      entitlements: { include: { sport: { select: { id: true, name: true } } }, orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json({ data: plans });
}

export async function POST(request: Request) {
  let body: unknown;
  let actor;

  try {
    actor = await requirePermission(request, "catalog.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

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

  if (parsed.data.planKind !== "CLASS" && !(await isTenantModuleEnabled(actor.tenantId, "GYM"))) {
    return NextResponse.json({ error: "Le module salle n'est pas actif pour ce club" }, { status: 403 });
  }
  const classRights = parsed.data.entitlements.filter((item) => item.type === "CLASS_SESSIONS");
  const sportIds = classRights.map((item) => item.sportId).filter((id): id is string => Boolean(id));
  const sports = await prisma.sport.findMany({
    where: { id: { in: sportIds }, tenantId: actor.tenantId, isActive: true },
    select: { id: true },
  });
  if (sports.length !== new Set(sportIds).size) {
    return NextResponse.json({ error: "Discipline introuvable ou inactive" }, { status: 400 });
  }
  for (const entitlement of classRights) {
    const capError = await validatePlanSessionsPerWeekForSport(
      entitlement.sportId as string,
      entitlement.sessionsPerWeek as number,
      new Date(),
      actor.tenantId,
    );
    if (capError) return NextResponse.json({ error: capError, code: "PLAN_EXCEEDS_SPORT_STANDARD" }, { status: 409 });
  }

  try {
    const plan = await prisma.$transaction(async (tx) => {
      const created = await tx.subscriptionPlan.create({
        data: {
          tenantId: actor.tenantId,
          name: parsed.data.name,
          description: parsed.data.description?.trim() || null,
          price: parsed.data.price,
          totalSessions: parsed.data.totalSessions,
          sessionsPerWeek: parsed.data.sessionsPerWeek ?? null,
          validityDays: parsed.data.validityDays,
          planKind: parsed.data.planKind,
          sportId: parsed.data.sportId ?? null,
        },
        include: { sport: { select: { name: true } } },
      });
      await tx.planEntitlement.createMany({
        data: parsed.data.entitlements.map((item, index) => ({
          tenantId: actor.tenantId,
          planId: created.id,
          type: item.type,
          sportId: item.type === "CLASS_SESSIONS" ? item.sportId ?? null : null,
          sessionsPerWeek: item.type === "CLASS_SESSIONS" ? item.sessionsPerWeek ?? null : null,
          grantedUnits: item.gymAccessMode === "UNLIMITED" ? null : item.grantedUnits ?? null,
          gymAccessMode: item.type === "GYM_ACCESS" ? item.gymAccessMode ?? null : null,
          sortOrder: index,
        })),
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "SUBSCRIPTION_PLAN_CREATED",
          entityType: "SubscriptionPlan",
          entityId: created.id,
          userId: actor.id,
          details: JSON.stringify({ after: planAuditSnapshot(created) }),
        },
      });

      return created;
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
  let actor;

  try {
    actor = await requirePermission(request, "catalog.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

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
    const currentPlan = await prisma.subscriptionPlan.findFirst({
      where: { id: planId, tenantId: actor.tenantId },
      include: { sport: { select: { name: true } }, entitlements: { orderBy: { sortOrder: "asc" } } },
    });

    if (!currentPlan) {
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
    }

    const merged = createSubscriptionPlanSchema.safeParse({
      name: payload.name ?? currentPlan.name,
      description: payload.description === undefined ? currentPlan.description : payload.description,
      price: payload.price ?? currentPlan.price,
      planKind: payload.planKind ?? currentPlan.planKind,
      validityDays: payload.validityDays ?? currentPlan.validityDays,
      sportId: payload.sportId === undefined ? currentPlan.sportId ?? undefined : payload.sportId || undefined,
      sessionsPerWeek: payload.sessionsPerWeek ?? currentPlan.sessionsPerWeek ?? undefined,
      entitlements: payload.entitlements ?? currentPlan.entitlements.map((item) => ({
        type: item.type,
        sportId: item.sportId,
        sessionsPerWeek: item.sessionsPerWeek,
        grantedUnits: item.grantedUnits,
        gymAccessMode: item.gymAccessMode,
      })),
    });
    if (!merged.success) {
      return NextResponse.json({ error: "Configuration de formule invalide", details: merged.error.flatten() }, { status: 400 });
    }
    if (merged.data.planKind !== "CLASS" && !(await isTenantModuleEnabled(actor.tenantId, "GYM"))) {
      return NextResponse.json({ error: "Le module salle n'est pas actif pour ce club" }, { status: 403 });
    }
    const nextClassRights = merged.data.entitlements.filter((item) => item.type === "CLASS_SESSIONS");
    const nextSportIds = nextClassRights.map((item) => item.sportId).filter((id): id is string => Boolean(id));
    const validSports = await prisma.sport.count({ where: { id: { in: nextSportIds }, tenantId: actor.tenantId, isActive: true } });
    if (validSports !== new Set(nextSportIds).size) return NextResponse.json({ error: "Discipline introuvable ou inactive" }, { status: 400 });
    for (const entitlement of nextClassRights) {
      const capError = await validatePlanSessionsPerWeekForSport(entitlement.sportId as string, entitlement.sessionsPerWeek as number, new Date(), actor.tenantId);
      if (capError) return NextResponse.json({ error: capError, code: "PLAN_EXCEEDS_SPORT_STANDARD" }, { status: 409 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.subscriptionPlan.update({
        where: { id: planId },
        data: {
          name: merged.data.name,
          description: merged.data.description?.trim() || null,
          price: merged.data.price,
          planKind: merged.data.planKind,
          totalSessions: merged.data.totalSessions,
          sessionsPerWeek: merged.data.sessionsPerWeek ?? null,
          validityDays: merged.data.validityDays,
          isActive: payload.isActive,
          sportId: merged.data.sportId ?? null,
        },
        include: { sport: { select: { name: true } } },
      });

      await tx.planEntitlement.deleteMany({ where: { tenantId: actor.tenantId, planId } });
      await tx.planEntitlement.createMany({
        data: merged.data.entitlements.map((item, index) => ({
          tenantId: actor.tenantId,
          planId,
          type: item.type,
          sportId: item.type === "CLASS_SESSIONS" ? item.sportId ?? null : null,
          sessionsPerWeek: item.type === "CLASS_SESSIONS" ? item.sessionsPerWeek ?? null : null,
          grantedUnits: item.gymAccessMode === "UNLIMITED" ? null : item.grantedUnits ?? null,
          gymAccessMode: item.type === "GYM_ACCESS" ? item.gymAccessMode ?? null : null,
          sortOrder: index,
        })),
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "SUBSCRIPTION_PLAN_UPDATED",
          entityType: "SubscriptionPlan",
          entityId: planId,
          userId: actor.id,
          details: JSON.stringify({
            before: planAuditSnapshot(currentPlan),
            after: planAuditSnapshot(next),
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
  let actor;

  try {
    actor = await requirePermission(request, "catalog.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

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

  const linkedSubscriptions = await prisma.memberSubscription.findMany({
    where: { tenantId: actor.tenantId, planId },
    select: {
      id: true,
      member: { select: { firstName: true, lastName: true } },
    },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  if (linkedSubscriptions.length > 0) {
    return NextResponse.json(
      {
        error: `Cette formule est encore utilisée (${linkedSubscriptions.length} abonnement(s)). Désactivez-la ou supprimez les abonnements liés d'abord.`,
        details: {
          subscriptions: linkedSubscriptions.map((s) => ({
            id: s.id,
            label: `${s.member.firstName} ${s.member.lastName}`,
          })),
        },
      },
      { status: 409 },
    );
  }

  try {
    const deactivated = await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        action: "SUBSCRIPTION_PLAN_DEACTIVATED",
        entityType: "SubscriptionPlan",
        entityId: planId,
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
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
    }

    if (code === "P2003") {
      return NextResponse.json(
        {
          error:
            "Impossible de supprimer : cette formule est encore référencée par des abonnements.",
        },
        { status: 409 },
      );
    }

    console.error("[DELETE /api/subscription-plans]", error);
    return NextResponse.json({ error: "Erreur serveur lors de la desactivation" }, { status: 500 });
  }
}
