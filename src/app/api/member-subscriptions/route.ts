import { NextResponse } from "next/server";
import type { SubscriptionStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  createMemberSubscriptionSchema,
  updateMemberSubscriptionSchema,
} from "@/lib/schemas/member-subscription";
import { jsonAuthFailureResponse, requireAnyPermission, requirePermission } from "@/lib/permissions";
import {
  checkScheduleConflictForMember,
  computeEndDate,
  expireStaleSubscriptions,
} from "@/lib/membership-rules";
import { checkGroupMemberCompatibility } from "@/lib/demographics";
import { createSubscriptionFromPlan } from "@/lib/subscription-service";
import { sumLedgerRows } from "@/lib/payment-ledger";
import { issueReceiptForPayment } from "@/lib/receipts";
import { resolveMemberPhone } from "@/lib/member-phone";
import { memberAuditSnapshot } from "@/lib/member-audit";
import { activeAssignmentWindow } from "@/lib/assignment-policy";
import {
  IdempotencyKeyConflictError,
  InvalidIdempotencyKeyError,
  idempotencyResponseHeaders,
  readIdempotencyKey,
  replayIdempotentResponse,
  runIdempotentSerializableTransaction,
} from "@/lib/idempotency";
import { getTenantProductContext } from "@/platform/product/product-context";

export const runtime = "nodejs";

const VALID_STATUSES: string[] = ["ACTIVE", "EXPIRED", "CANCELLED", "DRAFT"];

function idempotencyErrorResponse(error: unknown) {
  if (error instanceof InvalidIdempotencyKeyError) {
    return NextResponse.json({ error: "Clé d'idempotence invalide" }, { status: 400 });
  }
  if (error instanceof IdempotencyKeyConflictError) {
    return NextResponse.json(
      { error: "Cette clé d'idempotence a déjà servi pour une autre requête" },
      { status: 409 },
    );
  }
  return null;
}

type SubscriptionAuditSnapshotInput = {
  id: string;
  memberId: string;
  planId: string;
  sportId: string | null;
  startDate: Date;
  endDate: Date | null;
  amount: number;
  remainingSessions: number;
  status: string;
};

function subscriptionAuditSnapshot(subscription: SubscriptionAuditSnapshotInput) {
  return {
    id: subscription.id,
    memberId: subscription.memberId,
    planId: subscription.planId,
    sportId: subscription.sportId,
    startDate: subscription.startDate.toISOString(),
    endDate: subscription.endDate ? subscription.endDate.toISOString() : null,
    amount: subscription.amount,
    remainingSessions: subscription.remainingSessions,
    status: subscription.status,
  };
}

function changedSubscriptionFields(
  before: ReturnType<typeof subscriptionAuditSnapshot>,
  after: ReturnType<typeof subscriptionAuditSnapshot>,
) {
  return Object.keys(after).filter((key) => {
    if (key === "id" || key === "memberId") return false;
    return before[key as keyof typeof before] !== after[key as keyof typeof after];
  });
}

export async function GET(request: Request) {
  let actor;
  try {
    actor = await requireAnyPermission(request, ["enrollment.sell", "subscriptions.correct"]);
  } catch (e) {
    return jsonAuthFailureResponse(e);
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
      tenantId: actor.tenantId,
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
      plan: { select: { id: true, name: true, planKind: true, price: true, totalSessions: true, sessionsPerWeek: true, validityDays: true } },
      sport: { select: { id: true, name: true } },
      payments: { select: { id: true, amount: true, paymentDate: true } },
      entitlements: { include: { sport: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ data: subscriptions });
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "enrollment.sell");
  } catch (e) {
    return jsonAuthFailureResponse(e);
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

  let idempotencyKey: string | null;
  try {
    idempotencyKey = readIdempotencyKey(request);
  } catch (error) {
    return idempotencyErrorResponse(error) ?? NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  const idempotencyParams = {
    tenantId: actor.tenantId,
    scope: "member-subscriptions:create",
    idempotencyKey,
    requestPayload: parsed.data,
  };
  try {
    const replay = await replayIdempotentResponse<{ data: unknown }>(idempotencyParams);
    if (replay) {
      return NextResponse.json(replay.response.body, {
        status: replay.response.status,
        headers: idempotencyResponseHeaders(true),
      });
    }
  } catch (error) {
    const response = idempotencyErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const { memberId: requestedMemberId, newMember, planId, startDate, carryOverRemainingSessions, paymentCents, paymentMethod, groupIds = [] } =
    parsed.data;
  const start = new Date(startDate);

  try {
    const memberExists = requestedMemberId ? await prisma.member.findFirst({
      where: { id: requestedMemberId, tenantId: actor.tenantId },
    }) : null;
    if (requestedMemberId && !memberExists) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }
    if (memberExists && memberExists.status !== "ACTIVE") {
      return NextResponse.json({ error: "Impossible de creer un abonnement pour un membre archive" }, { status: 409 });
    }
    const memberProfile = memberExists ?? {
      memberType: newMember!.memberType,
      gender: newMember!.gender,
    };

    const plan = await prisma.subscriptionPlan.findFirst({
      where: { id: planId, tenantId: actor.tenantId },
      include: { entitlements: true },
    });
    if (!plan) {
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
    }
    const product = await getTenantProductContext(actor.tenantId);
    const planKindEnabled = plan.planKind === "CLASS"
      ? product.capabilities.classManagement
      : plan.planKind === "GYM"
        ? product.capabilities.gymAccess
        : product.capabilities.mixedSales;
    if (!planKindEnabled) {
      return NextResponse.json({ error: "Ce type de formule n'est pas actif pour ce club" }, { status: 403 });
    }
    if (plan.planKind !== "MIXED" && groupIds.length > 0) {
      return NextResponse.json({ error: "Les groupes sont reserves aux packs mixtes dans ce parcours" }, { status: 400 });
    }
    const classRights = plan.entitlements.filter((item) => item.type === "CLASS_SESSIONS");
    const selectedGroups = plan.planKind === "MIXED" && groupIds.length > 0
      ? await prisma.group.findMany({
          where: { tenantId: actor.tenantId, id: { in: groupIds }, isActive: true },
          include: { _count: { select: { members: { where: { tenantId: actor.tenantId, status: "ACTIVE" } } } } },
        })
      : [];
    if (plan.planKind === "MIXED") {
      if (selectedGroups.length !== groupIds.length) {
        return NextResponse.json({ error: "Un groupe selectionne est introuvable ou inactif" }, { status: 400 });
      }
      if (selectedGroups.length !== classRights.length || classRights.some((right) => !selectedGroups.some((group) => group.sportId === right.sportId))) {
        return NextResponse.json({ error: "Choisissez un groupe compatible pour chaque discipline du pack" }, { status: 400 });
      }
      const end = computeEndDate(start, plan.validityDays);
      for (const group of selectedGroups) {
        const compatibility = checkGroupMemberCompatibility({ groupType: group.groupType, genderPolicy: group.genderPolicy, memberType: memberProfile.memberType, gender: memberProfile.gender });
        if (!compatibility.ok) return NextResponse.json({ error: compatibility.message }, { status: 409 });
        const alreadyAssigned = requestedMemberId ? await prisma.groupMember.findFirst({ where: { tenantId: actor.tenantId, memberId: requestedMemberId, groupId: group.id, status: "ACTIVE" }, select: { id: true } }) : null;
        if (!alreadyAssigned && group._count.members >= group.capacity) return NextResponse.json({ error: `Le groupe "${group.name}" est complet` }, { status: 409 });
        if (requestedMemberId) {
          const conflict = await checkScheduleConflictForMember(requestedMemberId, group.id, start, end);
          if (!conflict.ok) return NextResponse.json({ error: conflict.error }, { status: 409 });
        }
      }
    }

    if (plan.sportId && requestedMemberId) {
      const incompatibleGroup = await prisma.groupMember.findFirst({
        where: {
          tenantId: actor.tenantId,
          memberId: requestedMemberId,
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

    const payCents = paymentCents ?? 0;
    if (payCents > plan.price) {
      return NextResponse.json({ error: "Dépassement du montant dû pour cette formule" }, { status: 409 });
    }

    const result = await runIdempotentSerializableTransaction(idempotencyParams, async (tx) => {
      let memberId = requestedMemberId ?? "";
      if (newMember) {
        const createdMember = await tx.member.create({
          data: {
            tenantId: actor.tenantId,
            firstName: newMember.firstName,
            lastName: newMember.lastName,
            phone: resolveMemberPhone(newMember),
            email: newMember.email?.trim() || null,
            memberType: newMember.memberType,
            gender: newMember.gender,
            birthDate: new Date(newMember.birthDate),
            address: newMember.address?.trim() || null,
            parentName: newMember.parentName?.trim() || null,
            parentPhone: newMember.parentPhone?.trim() || null,
            parentAddress: newMember.parentAddress?.trim() || null,
          },
        });
        memberId = createdMember.id;
        await tx.auditLog.create({
          data: {
            tenantId: actor.tenantId,
            action: "MEMBER_CREATED",
            entityType: "Member",
            entityId: createdMember.id,
            userId: actor.id,
            details: JSON.stringify({ source: "access-enrollment", after: memberAuditSnapshot(createdMember) }),
          },
        });
      }

      for (const selectedGroup of selectedGroups) {
        const freshGroup = await tx.group.findFirst({
          where: { id: selectedGroup.id, tenantId: actor.tenantId, isActive: true },
          select: { capacity: true },
        });
        if (!freshGroup) throw new Error("GROUP_NOT_FOUND");

        const otherActiveAssignments = await tx.groupMember.count({
          where: {
            tenantId: actor.tenantId,
            groupId: selectedGroup.id,
            ...activeAssignmentWindow(start),
            NOT: { memberId },
          },
        });
        if (otherActiveAssignments >= freshGroup.capacity) {
          throw new Error("GROUP_CAPACITY_REACHED");
        }
      }

      const created = await createSubscriptionFromPlan(
        tx,
        {
          tenantId: actor.tenantId,
          memberId,
          plan,
          startDate: start,
        },
        { carryOverRemainingSessions: carryOverRemainingSessions === true },
      );

      for (const group of selectedGroups) {
        await tx.groupMember.upsert({
          where: { tenantId_groupId_memberId: { tenantId: actor.tenantId, groupId: group.id, memberId } },
          update: { status: "ACTIVE", startDate: start, endDate: created.endDate },
          create: { tenantId: actor.tenantId, groupId: group.id, memberId, status: "ACTIVE", startDate: start, endDate: created.endDate },
        });
      }

      if (payCents > 0) {
        const payment = await tx.payment.create({
          data: {
            tenantId: actor.tenantId,
            memberSubscriptionId: created.id,
            amount: payCents,
            createdById: actor.id,
            paymentMethod: paymentMethod?.trim() || "CASH",
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId: actor.tenantId,
            action: "PAYMENT_CREATED",
            entityType: "Payment",
            entityId: payment.id,
            userId: actor.id,
            details: JSON.stringify({
              tenantId: actor.tenantId,
              source: "member-subscription",
              amount: payCents,
              memberId,
              subscriptionId: created.id,
            }),
          },
        });

        const receipt = await issueReceiptForPayment(tx, payment.id, actor.id, actor.tenantId);
        await tx.auditLog.create({
          data: {
            tenantId: actor.tenantId,
            action: "RECEIPT_ISSUED",
            entityType: "Receipt",
            entityId: receipt.id,
            userId: actor.id,
            details: JSON.stringify({
              tenantId: actor.tenantId,
              paymentId: payment.id,
              receiptNumber: receipt.receiptNumber,
              source: "member-subscription",
            }),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "MEMBER_SUBSCRIPTION_CREATED",
          entityType: "MemberSubscription",
          entityId: created.id,
          userId: actor.id,
          details: JSON.stringify({
            tenantId: actor.tenantId,
            memberId,
            planId,
            sportId: plan.sportId,
            amount: created.amount,
            remainingSessions: created.remainingSessions,
            carryOverRemainingSessions: carryOverRemainingSessions === true,
            paymentCents: payCents,
            startDate: start.toISOString(),
          }),
        },
      });

      const withRelations = await tx.memberSubscription.findFirstOrThrow({
        where: { id: created.id, tenantId: actor.tenantId },
        include: {
          member: { select: { id: true, firstName: true, lastName: true } },
          plan: { select: { id: true, name: true } },
          sport: { select: { id: true, name: true } },
          payments: { select: { id: true, amount: true, paymentDate: true } },
          entitlements: {
            include: { sport: { select: { id: true, name: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      return { status: 201, body: { data: withRelations } };
    });

    return NextResponse.json(result.response.body, {
      status: result.response.status,
      headers: idempotencyResponseHeaders(result.replayed),
    });
  } catch (error) {
    const idempotencyResponse = idempotencyErrorResponse(error);
    if (idempotencyResponse) return idempotencyResponse;
    if (error instanceof Error && error.message === "GROUP_CAPACITY_REACHED") {
      return NextResponse.json({ error: "Un groupe sélectionné est complet" }, { status: 409 });
    }
    if (error instanceof Error && error.message === "GROUP_NOT_FOUND") {
      return NextResponse.json({ error: "Un groupe sélectionné est introuvable ou inactif" }, { status: 409 });
    }
    console.error("[POST /api/member-subscriptions] error:", error);
    return NextResponse.json({ error: "Erreur serveur lors de la création de l'abonnement" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "subscriptions.correct");
  } catch (e) {
    return jsonAuthFailureResponse(e);
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
  let idempotencyKey: string | null;
  try {
    idempotencyKey = readIdempotencyKey(request);
  } catch (error) {
    return idempotencyErrorResponse(error) ?? NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  const idempotencyParams = {
    tenantId: actor.tenantId,
    scope: "member-subscriptions:update",
    idempotencyKey,
    requestPayload: { subscriptionId, payload },
  };
  try {
    const replay = await replayIdempotentResponse<{ data: unknown }>(idempotencyParams);
    if (replay) {
      return NextResponse.json(replay.response.body, {
        status: replay.response.status,
        headers: idempotencyResponseHeaders(true),
      });
    }
  } catch (error) {
    const response = idempotencyErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const sensitive =
    payload.planId !== undefined ||
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
    const existing = await prisma.memberSubscription.findFirst({
      where: { id: subscriptionId, tenantId: actor.tenantId },
      select: {
        id: true,
        memberId: true,
        planId: true,
        sportId: true,
        startDate: true,
        endDate: true,
        status: true,
        amount: true,
        remainingSessions: true,
        member: { select: { status: true } },
        payments: { select: { amount: true } },
        plan: { select: { planKind: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 });
    }

    if (existing.member.status !== "ACTIVE") {
      return NextResponse.json({ error: "Impossible de modifier l'abonnement d'un membre archive" }, { status: 409 });
    }

    const nextStartDate = payload.startDate ? new Date(payload.startDate) : existing.startDate;
    const nextEndDate =
      payload.endDate === undefined ? existing.endDate : payload.endDate === null ? null : new Date(payload.endDate);

    if (nextEndDate && nextEndDate.getTime() < nextStartDate.getTime()) {
      return NextResponse.json({ error: "La date de fin doit etre >= date de debut" }, { status: 400 });
    }

    const totalPaid = sumLedgerRows(existing.payments);
    if (payload.amount !== undefined && payload.amount < totalPaid) {
      return NextResponse.json(
        { error: "Le montant de l'abonnement ne peut pas etre inferieur au total deja paye" },
        { status: 409 },
      );

    }

    const planChanged = payload.planId !== undefined && payload.planId !== existing.planId;
    const statusChanged = payload.status !== undefined && payload.status !== existing.status;
    const sensitiveChange =
      planChanged ||
      statusChanged ||
      (payload.amount !== undefined && payload.amount !== existing.amount) ||
      (payload.remainingSessions !== undefined && payload.remainingSessions !== existing.remainingSessions);

    if (sensitiveChange && actor.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Seul un administrateur peut modifier la formule, le statut, le montant ou les séances" },
        { status: 403 },
      );
    }

    if (sensitiveChange && !payload.adjustmentReason?.trim()) {
      return NextResponse.json(
        { error: "Motif obligatoire pour modifier la formule, le statut, le montant ou les séances restantes" },
        { status: 400 },
      );
    }

    let nextSportId = existing.sportId;
    let nextPlanKind = existing.plan.planKind;
    if (payload.planId) {
      const planExists = await prisma.subscriptionPlan.findFirst({
        where: { id: payload.planId, tenantId: actor.tenantId },
        select: { id: true, sportId: true, planKind: true },
      });
      if (!planExists) {
        return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
      }
      nextSportId = planExists.sportId;
      nextPlanKind = planExists.planKind;
      if (planChanged && (existing.plan.planKind !== "CLASS" || nextPlanKind !== "CLASS")) {
        return NextResponse.json(
          { error: "Pour changer les droits d'un pass salle ou mixte, resiliez cet abonnement puis creez-en un nouveau" },
          { status: 409 },
        );
      }
    }

    if (payload.planId && nextSportId && nextSportId !== existing.sportId) {
      const incompatibleAssignment = await prisma.groupMember.findFirst({
        where: {
          tenantId: actor.tenantId,
          memberId: existing.memberId,
          status: "ACTIVE",
          group: { sportId: { not: nextSportId } },
        },
        select: { group: { select: { name: true } } },
      });

      if (incompatibleAssignment) {
        return NextResponse.json(
          { error: `Changement de discipline impossible avec l'affectation active "${incompatibleAssignment.group.name}"` },
          { status: 409 },
        );
      }
    }

    const beforeSnapshot = subscriptionAuditSnapshot(existing);
    const result = await runIdempotentSerializableTransaction(idempotencyParams, async (tx) => {
      const updatedSubscription = await tx.memberSubscription.update({
        where: { id: subscriptionId },
        data: {
          planId: payload.planId,
          startDate: payload.startDate ? nextStartDate : undefined,
          endDate: payload.endDate === undefined ? undefined : nextEndDate,
          amount: payload.amount,
          remainingSessions: payload.remainingSessions,
          status: payload.status,
          ...(payload.planId ? { sportId: nextSportId } : {}),
        },
        include: {
          member: { select: { id: true, firstName: true, lastName: true } },
          plan: { select: { id: true, name: true } },
          sport: { select: { id: true, name: true } },
        },
      });
      const nextPlanEntitlement = payload.planId
        ? await tx.planEntitlement.findFirst({
            where: { tenantId: actor.tenantId, planId: payload.planId, type: "CLASS_SESSIONS" },
            orderBy: { sortOrder: "asc" },
          })
        : null;
      if (payload.startDate || payload.endDate !== undefined) {
        await tx.subscriptionEntitlement.updateMany({
          where: { tenantId: actor.tenantId, memberSubscriptionId: subscriptionId },
          data: {
            ...(payload.startDate ? { startDate: nextStartDate } : {}),
            ...(payload.endDate !== undefined ? { endDate: nextEndDate } : {}),
          },
        });
      }
      await tx.subscriptionEntitlement.updateMany({
        where: { tenantId: actor.tenantId, memberSubscriptionId: subscriptionId, type: "CLASS_SESSIONS" },
        data: {
          ...(payload.planId && nextPlanEntitlement
            ? {
                planEntitlementId: nextPlanEntitlement.id,
                sportId: nextPlanEntitlement.sportId,
                sessionsPerWeek: nextPlanEntitlement.sessionsPerWeek,
                grantedUnits: nextPlanEntitlement.grantedUnits,
              }
            : {}),
          ...(payload.remainingSessions !== undefined ? { remainingUnits: payload.remainingSessions } : {}),
        },
      });
      const afterSnapshot = subscriptionAuditSnapshot(updatedSubscription);

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "MEMBER_SUBSCRIPTION_UPDATED",
          entityType: "MemberSubscription",
          entityId: subscriptionId,
          userId: actor.id,
          details: JSON.stringify({
            tenantId: actor.tenantId,
            changedFields: changedSubscriptionFields(beforeSnapshot, afterSnapshot),
            before: beforeSnapshot,
            after: afterSnapshot,
            reason: payload.adjustmentReason?.trim() || null,
            totalPaid,
          }),
        },
      });

      return { status: 200, body: { data: updatedSubscription } };
    });

    return NextResponse.json(result.response.body, {
      status: result.response.status,
      headers: idempotencyResponseHeaders(result.replayed),
    });
  } catch (error) {
    const idempotencyResponse = idempotencyErrorResponse(error);
    if (idempotencyResponse) return idempotencyResponse;
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
  let actor;
  try {
    actor = await requirePermission(request, "subscriptions.correct");
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

  const reasonValue = (body as { reason?: unknown }).reason;
  const rawReason = typeof reasonValue === "string" ? reasonValue.trim() : "";
  const reason = rawReason || "Résiliation admin";
  let idempotencyKey: string | null;
  try {
    idempotencyKey = readIdempotencyKey(request);
  } catch (error) {
    return idempotencyErrorResponse(error) ?? NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  const idempotencyParams = {
    tenantId: actor.tenantId,
    scope: "member-subscriptions:cancel",
    idempotencyKey,
    requestPayload: { subscriptionId, reason },
  };
  try {
    const replay = await replayIdempotentResponse<{ data: unknown }>(idempotencyParams);
    if (replay) {
      return NextResponse.json(replay.response.body, {
        status: replay.response.status,
        headers: idempotencyResponseHeaders(true),
      });
    }
  } catch (error) {
    const response = idempotencyErrorResponse(error);
    if (response) return response;
    throw error;
  }

  try {
    const now = new Date();
    const existing = await prisma.memberSubscription.findFirst({
      where: { id: subscriptionId, tenantId: actor.tenantId },
      select: {
        id: true,
        memberId: true,
        planId: true,
        sportId: true,
        startDate: true,
        endDate: true,
        status: true,
        amount: true,
        remainingSessions: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 });
    }

    const beforeSnapshot = subscriptionAuditSnapshot(existing);
    const result = await runIdempotentSerializableTransaction(idempotencyParams, async (tx) => {
      const subscription = await tx.memberSubscription.update({
        where: { id: subscriptionId },
        data: { status: "CANCELLED" },
      });
      const afterSnapshot = subscriptionAuditSnapshot(subscription);

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "MEMBER_SUBSCRIPTION_CANCELLED",
          entityType: "MemberSubscription",
          entityId: subscriptionId,
          userId: actor.id,
          details: JSON.stringify({
            tenantId: actor.tenantId,
            cancelledAt: now.toISOString(),
            reason,
            changedFields: changedSubscriptionFields(beforeSnapshot, afterSnapshot),
            before: beforeSnapshot,
            after: afterSnapshot,
          }),
        },
      });

      return { status: 200, body: { data: subscription } };
    });

    return NextResponse.json(result.response.body, {
      status: result.response.status,
      headers: idempotencyResponseHeaders(result.replayed),
    });
  } catch (error) {
    const idempotencyResponse = idempotencyErrorResponse(error);
    if (idempotencyResponse) return idempotencyResponse;
    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025";

    if (isNotFound) {
      return NextResponse.json({ error: "Abonnement introuvable" }, { status: 404 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de la résiliation de l'abonnement" }, { status: 500 });
  }
}
