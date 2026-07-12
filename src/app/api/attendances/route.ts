import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createAttendanceSchema, updateAttendanceSchema } from "@/lib/schemas/attendance";
import { getClubSettings } from "@/lib/club-settings";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import {
  RECOVERY_OVERRIDE_PREFIX,
  validateRecoveryCheckIn,
} from "@/lib/attendance-rules";
import {
  applySessionBalanceDelta,
} from "@/lib/attendance-session-adjustment";
import {
  computeAttendanceConsumptionUnits,
  resolveAttendanceConsumptionChange,
  resolveCheckInConsumption,
} from "@/lib/weekly-session-consumption";
import {
  canCheckInWithPayment,
  resolveActiveSubscription,
  resolveSubscriptionForAttendance,
} from "@/lib/membership-rules";
import {
  activeMemberFailure,
  assignmentFailure,
  overrideReasonFailure,
  paidSubscriptionFailure,
  sessionMutationFailure,
} from "@/lib/attendance-policy";
import {
  attendanceAuditSnapshot,
  attendanceCreatedAuditDetails,
  attendanceDeletedAuditDetails,
  attendanceUpdatedAuditDetails,
} from "@/lib/attendance-audit-details";
import {
  attendancePolicyResponse,
  countAttendanceOverrides,
  isPrismaErrorCode,
  readAttendanceIdFromBody,
} from "@/lib/attendance-route-helpers";
import { withTenantContext } from "@/lib/tenant-context";

export const runtime = "nodejs";

type AttendanceActor = Awaited<ReturnType<typeof requirePermission>>;

function tenantContextFor(actor: AttendanceActor) {
  return { tenantId: actor.tenantId, tenantSlug: actor.tenantSlug };
}

export async function GET(request: Request) {
  let actor: AttendanceActor;
  try {
    actor = await requirePermission(request, "attendance.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  return withTenantContext(tenantContextFor(actor), () => handleGet(request, actor));
}

async function handleGet(request: Request, actor: AttendanceActor) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId")?.trim();
  const memberId = searchParams.get("memberId")?.trim();

  const attendances = await prisma.attendance.findMany({
    where: {
      tenantId: actor.tenantId,
      ...(sessionId ? { sessionId } : {}),
      ...(memberId ? { memberId } : {}),
    },
    include: {
      session: {
        select: {
          id: true,
          sessionDate: true,
          startTime: true,
          group: { select: { id: true, name: true } },
        },
      },
      member: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { checkedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ data: attendances });
}

export async function POST(request: Request) {
  let actor: AttendanceActor;
  try {
    actor = await requirePermission(request, "attendance.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  return withTenantContext(tenantContextFor(actor), () => handlePost(request, actor));
}

async function handlePost(request: Request, actor: AttendanceActor) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = createAttendanceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { sessionId, memberId, status, overrideReason, overrideKind } = parsed.data;
  const clubSettings = await getClubSettings();
  const isRecoveryOverride = status === "OVERRIDE" && overrideKind === "RECOVERY";
  const normalizedOverrideReason = isRecoveryOverride
    ? `${RECOVERY_OVERRIDE_PREFIX}${overrideReason?.trim() ? ` — ${overrideReason.trim()}` : ""}`
    : overrideReason?.trim() || null;

  try {
    const sessionExists = await prisma.session.findFirst({
      where: { id: sessionId, tenantId: actor.tenantId },
      include: {
        group: { select: { id: true, sportId: true, groupType: true } },
      },
    });
    if (!sessionExists) {
      return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
    }
    const sessionFailure = sessionMutationFailure(sessionExists.status, "pointer");
    if (sessionFailure) {
      return attendancePolicyResponse(sessionFailure);
    }
    if (sessionExists.status === "CANCELLED") {
      return NextResponse.json({ error: "Impossible de pointer une séance annulée" }, { status: 409 });
    }
    if (sessionExists.status === "COMPLETED") {
      return NextResponse.json(
        {
          error: "Cette séance est finalisée. Rouvrez-la avant de corriger le pointage.",
          code: "SESSION_REOPEN_REQUIRED",
        },
        { status: 409 },
      );
    }

    const memberExists = await prisma.member.findFirst({
      where: { id: memberId, tenantId: actor.tenantId },
    });
    if (!memberExists) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    if (memberExists.status === "ARCHIVED") {
      return NextResponse.json({ error: "Impossible de pointer un membre résilié" }, { status: 403 });
    }

    const memberFailure = await activeMemberFailure(memberId);
    if (memberFailure) {
      return attendancePolicyResponse(memberFailure);
    }

    const sportId = sessionExists.group.sportId;
    const activeSub = await resolveSubscriptionForAttendance(
      memberId,
      sportId,
      sessionExists.sessionDate,
    );
    const isSubActive = !!activeSub;
    let consumptionUnits = 0;

    if (isRecoveryOverride) {
      if (!isSubActive || !activeSub) {
        return NextResponse.json(
          {
            error: "Abonnement actif requis pour une récupération de séance",
            code: "RECOVERY_REQUIRES_SUBSCRIPTION",
          },
          { status: 403 },
        );
      }

      const payCheck = await canCheckInWithPayment(activeSub);
      if (!payCheck.allowed) {
        return NextResponse.json(
          {
            error: payCheck.reason ?? "Abonnement non payé — récupération impossible",
            code: "SUBSCRIPTION_UNPAID",
          },
          { status: 403 },
        );
      }

      const recoveryCheck = await validateRecoveryCheckIn({
        memberId,
        targetSessionId: sessionExists.id,
        targetGroupId: sessionExists.group.id,
        targetSportId: sessionExists.group.sportId,
        targetGroupType: sessionExists.group.groupType,
        targetSessionDate: sessionExists.sessionDate,
      });

      if (!recoveryCheck.ok) {
        return NextResponse.json(
          { error: recoveryCheck.error, code: recoveryCheck.code },
          { status: 403 },
        );
      }
    } else if (status === "PRESENT" || status === "ABSENT") {
      const assignmentCheck = await assignmentFailure(sessionExists.group.id, memberId, sessionExists.sessionDate);
      if (assignmentCheck) {
        return attendancePolicyResponse(assignmentCheck);
      }

      const subscriptionCheck = await paidSubscriptionFailure(memberId, sportId, sessionExists.sessionDate);
      if ("failure" in subscriptionCheck) {
        return attendancePolicyResponse(subscriptionCheck.failure);
      }

      let checkInConsumption = null as Awaited<ReturnType<typeof resolveCheckInConsumption>> | null;

      if (activeSub) {
        checkInConsumption = await resolveCheckInConsumption({
          status,
          sessionId: sessionExists.id,
          groupId: sessionExists.group.id,
          sessionDate: sessionExists.sessionDate,
          memberId,
          memberSubscriptionId: activeSub.id,
          planSessionsPerWeek: activeSub.plan.sessionsPerWeek,
          absentConsumesSession: clubSettings.absentConsumesSession,
        });

        if (activeSub.plan.sessionsPerWeek && checkInConsumption.blockPresent) {
          return NextResponse.json(
            {
              error: "Quota hebdomadaire atteint — passage exceptionnel requis",
              code: "SUBSCRIPTION_WEEK_LIMIT_REACHED",
              limit: activeSub.plan.sessionsPerWeek,
            },
            { status: 403 },
          );
        }

        consumptionUnits = checkInConsumption.units;
      }
    }

    if (status === "OVERRIDE" && !isRecoveryOverride) {
      if (!overrideReason || overrideReason.trim().length === 0) {
        return NextResponse.json(
          { error: "Motif obligatoire pour un passage exceptionnel" },
          { status: 400 },
        );
      }

      const clubSettings = await getClubSettings();
      if (!clubSettings.allowCheckInWithoutSubscription && !isSubActive) {
        return NextResponse.json(
          {
            error: "Pointage sans abonnement désactivé — règles du club",
            code: "OVERRIDE_WITHOUT_SUBSCRIPTION_DISABLED",
          },
          { status: 403 },
        );
      }

      const overrideCount = await countAttendanceOverrides(memberId, actor.tenantId);

      if (overrideCount >= 3) {
        return NextResponse.json(
          {
            error: "Limite de passages exceptionnels atteinte (3/30j) — validation managériale requise",
            code: "OVERRIDE_LIMIT_REACHED",
            count: overrideCount,
          },
          { status: 403 },
        );
      }

      if (overrideCount >= 2) {
        // avertissement enregistré mais on laisse passer
        // le front affichera le warning
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let remainingSessionsBefore: number | null = null;
      let subscriptionEntitlementId = activeSub?.entitlementId ?? null;

      if (consumptionUnits > 0) {
        if (isSubActive && activeSub) {
          remainingSessionsBefore = activeSub.remainingSessions;
          const adjustment = await applySessionBalanceDelta(tx, {
            delta: -consumptionUnits,
            memberSubscriptionId: activeSub.id,
            subscriptionEntitlementId: activeSub.entitlementId,
            memberId,
            sportId,
          });
          subscriptionEntitlementId = adjustment.subscriptionEntitlementId;
        }
      }

      const attendance = await tx.attendance.create({
        data: {
          tenantId: actor.tenantId,
          sessionId,
          memberId,
          status,
          overrideReason: normalizedOverrideReason,
          checkedBy: actor.name,
          memberSubscriptionId:
            isRecoveryOverride && activeSub
              ? activeSub.id
              : consumptionUnits > 0 && isSubActive && activeSub
                ? activeSub.id
                : null,
          subscriptionEntitlementId:
            isRecoveryOverride && activeSub
              ? activeSub.entitlementId
              : consumptionUnits > 0 && isSubActive
                ? subscriptionEntitlementId
                : null,
        },
        include: {
          session: {
            select: {
              id: true,
              sessionDate: true,
              startTime: true,
              group: { select: { id: true, name: true, sport: { select: { name: true } } } },
            },
          },
          member: { select: { id: true, firstName: true, lastName: true } },
          memberSubscription: {
            select: { id: true, sport: { select: { name: true } } },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "ATTENDANCE_CREATED",
          entityType: "Attendance",
          entityId: attendance.id,
          userId: actor.id,
          details: JSON.stringify(
            attendanceCreatedAuditDetails({
              sessionId,
              memberId,
              tenantId: actor.tenantId,
              status,
              sportId,
              overrideReason: normalizedOverrideReason,
              subscriptionActive: isSubActive,
              overrideKind: isRecoveryOverride ? "RECOVERY" : overrideKind ?? "STANDARD",
              remainingSessionsBefore,
            }),
          ),
        },
      });

      return attendance;
    });

    return NextResponse.json(
      {
        data: result,
        warning:
          status === "OVERRIDE" && (await countAttendanceOverrides(memberId, actor.tenantId)) >= 2
            ? "Attention: 2 passages exceptionnels sur 30 jours"
            : undefined,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NO_SESSIONS_LEFT") {
      return NextResponse.json(
        { error: "Plus de séances disponibles sur cet abonnement", code: "NO_SESSIONS_LEFT" },
        { status: 403 },
      );
    }

    if (isPrismaErrorCode(error, "P2002")) {
      return NextResponse.json(
        { error: "Présence déjà enregistrée pour ce membre sur cette séance" },
        { status: 409 },
      );
    }

    console.error("[POST /api/attendances] error:", error);
    return NextResponse.json({ error: "Erreur serveur lors de la création de la présence" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  let actor: AttendanceActor;
  try {
    actor = await requirePermission(request, "attendance.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  return withTenantContext(tenantContextFor(actor), () => handlePatch(request, actor));
}

async function handlePatch(request: Request, actor: AttendanceActor) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const attendanceIdResult = readAttendanceIdFromBody(body);
  if (!attendanceIdResult.ok) {
    return attendanceIdResult.response;
  }
  const { attendanceId } = attendanceIdResult;

  const updatePayload = updateAttendanceSchema.safeParse((body as Record<string, unknown>).payload);

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
    const clubSettings = await getClubSettings();
    const existing = await prisma.attendance.findFirst({
      where: { id: attendanceId, tenantId: actor.tenantId },
      select: {
        id: true,
        memberId: true,
        status: true,
        overrideReason: true,
        checkedBy: true,
        checkedAt: true,
        memberSubscriptionId: true,
        subscriptionEntitlementId: true,
        session: {
          select: {
            id: true,
            sessionDate: true,
            groupId: true,
            status: true,
            group: { select: { sportId: true } },
          },
        },
        memberSubscription: { select: { plan: { select: { sessionsPerWeek: true } } } },
        subscriptionEntitlement: { select: { sessionsPerWeek: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Présence introuvable" }, { status: 404 });
    }
    const sessionFailure = sessionMutationFailure(existing.session.status, "corriger");
    if (sessionFailure) {
      return attendancePolicyResponse(sessionFailure);
    }
    if (existing.session.status === "COMPLETED") {
      return NextResponse.json(
        {
          error: "Cette séance est finalisée. Rouvrez-la avant de corriger le pointage.",
          code: "SESSION_REOPEN_REQUIRED",
        },
        { status: 409 },
      );
    }

    const activeSub = await resolveSubscriptionForAttendance(
      existing.memberId,
      existing.session.group.sportId,
      existing.session.sessionDate,
    );
    const planSessionsPerWeek =
      existing.subscriptionEntitlement?.sessionsPerWeek ??
      existing.memberSubscription?.plan.sessionsPerWeek ??
      activeSub?.plan.sessionsPerWeek ??
      null;
    const subscriptionIdForConsumption = existing.memberSubscriptionId ?? activeSub?.id ?? null;

    const nextStatus = payload.status ?? existing.status;

    if (payload.status !== undefined && nextStatus === "OVERRIDE" && nextStatus !== existing.status) {
      const reasonFailure = overrideReasonFailure(nextStatus, payload.overrideReason);
      if (reasonFailure) {
        return attendancePolicyResponse(reasonFailure);
      }
    }

    if (payload.status !== undefined && (nextStatus === "PRESENT" || nextStatus === "ABSENT")) {
      const memberFailure = await activeMemberFailure(existing.memberId);
      if (memberFailure) {
        return attendancePolicyResponse(memberFailure);
      }

      const assignmentCheck = await assignmentFailure(
        existing.session.groupId,
        existing.memberId,
        existing.session.sessionDate,
      );
      if (assignmentCheck) {
        return attendancePolicyResponse(assignmentCheck);
      }

      const subscriptionCheck = await paidSubscriptionFailure(
        existing.memberId,
        existing.session.group.sportId,
        existing.session.sessionDate,
      );
      if ("failure" in subscriptionCheck) {
        return attendancePolicyResponse(subscriptionCheck.failure);
      }
    }

    if (nextStatus === "OVERRIDE" && nextStatus !== existing.status) {
      const overrideCount = await countAttendanceOverrides(existing.memberId, actor.tenantId);
      if (overrideCount >= 3) {
        return NextResponse.json(
          {
            error: "Limite de passages exceptionnels atteinte (3/30j) — validation managériale requise",
            code: "OVERRIDE_LIMIT_REACHED",
            count: overrideCount,
          },
          { status: 403 },
        );
      }
    }

    let delta = 0;

    if (payload.status !== undefined) {
      const consumptionChange = await resolveAttendanceConsumptionChange({
        previousStatus: existing.status,
        nextStatus,
        sessionId: existing.session.id,
        groupId: existing.session.groupId,
        sessionDate: existing.session.sessionDate,
        memberId: existing.memberId,
        memberSubscriptionId: subscriptionIdForConsumption,
        planSessionsPerWeek,
        absentConsumesSession: clubSettings.absentConsumesSession,
      });

      if (consumptionChange.blockPresent) {
        return NextResponse.json(
          {
            error: "Quota hebdomadaire atteint — passage exceptionnel requis",
            code: "SUBSCRIPTION_WEEK_LIMIT_REACHED",
            limit: planSessionsPerWeek,
          },
          { status: 403 },
        );
      }

      delta = consumptionChange.balanceDelta;
    }

    const beforeSnapshot = attendanceAuditSnapshot(existing);
    const updated = await prisma.$transaction(async (tx) => {
      let memberSubscriptionId = existing.memberSubscriptionId;
      let subscriptionEntitlementId = existing.subscriptionEntitlementId;

      if (delta !== 0) {
        const adjustment = await applySessionBalanceDelta(tx, {
          delta,
          memberSubscriptionId,
          subscriptionEntitlementId,
          memberId: existing.memberId,
          sportId: existing.session.group.sportId,
        });
        memberSubscriptionId = adjustment.memberSubscriptionId;
        subscriptionEntitlementId = adjustment.subscriptionEntitlementId;
      }

      const updatedAttendance = await tx.attendance.update({
        where: { id: attendanceId },
        data: {
          status: payload.status,
          memberSubscriptionId:
            payload.status !== undefined && nextStatus !== "OVERRIDE"
              ? memberSubscriptionId ?? subscriptionIdForConsumption
              : payload.status !== undefined
                ? null
                : undefined,
          subscriptionEntitlementId:
            payload.status !== undefined && nextStatus !== "OVERRIDE"
              ? subscriptionEntitlementId ?? activeSub?.entitlementId ?? null
              : payload.status !== undefined
                ? null
                : undefined,
          overrideReason:
            payload.overrideReason === undefined
              ? undefined
              : payload.overrideReason === "" || payload.overrideReason === null
                ? null
                : payload.overrideReason,
          checkedBy:
            payload.checkedBy === undefined
              ? undefined
              : payload.checkedBy === "" || payload.checkedBy === null
                ? null
                : payload.checkedBy,
        },
        include: {
          session: {
            select: {
              id: true,
              sessionDate: true,
              startTime: true,
              group: { select: { id: true, name: true } },
            },
          },
          member: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      const afterSnapshot = attendanceAuditSnapshot(updatedAttendance);

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "ATTENDANCE_UPDATED",
          entityType: "Attendance",
          entityId: attendanceId,
          userId: actor.id,
          details: JSON.stringify(
            attendanceUpdatedAuditDetails({
              tenantId: actor.tenantId,
              oldStatus: existing.status,
              newStatus: payload.status ?? existing.status,
              overrideReason: payload.overrideReason || null,
              sessionBalanceDelta: delta,
              before: beforeSnapshot,
              after: afterSnapshot,
            }),
          ),
        },
      });

      return updatedAttendance;
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_SESSIONS_LEFT") {
      return NextResponse.json(
        { error: "Plus de séances disponibles sur cet abonnement", code: "NO_SESSIONS_LEFT" },
        { status: 403 },
      );
    }
    if (error instanceof Error && error.message === "NO_ACTIVE_SUBSCRIPTION") {
      return NextResponse.json(
        { error: "Abonnement actif requis pour ce statut", code: "SUBSCRIPTION_INACTIVE" },
        { status: 403 },
      );
    }
    if (isPrismaErrorCode(error, "P2025")) {
      return NextResponse.json({ error: "Présence introuvable" }, { status: 404 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de la modification" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let actor: AttendanceActor;
  try {
    actor = await requirePermission(request, "attendance.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  return withTenantContext(tenantContextFor(actor), () => handleDelete(request, actor));
}

async function handleDelete(request: Request, actor: AttendanceActor) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const attendanceIdResult = readAttendanceIdFromBody(body);
  if (!attendanceIdResult.ok) {
    return attendanceIdResult.response;
  }
  const { attendanceId } = attendanceIdResult;

  try {
    const clubSettings = await getClubSettings();
    const existing = await prisma.attendance.findFirst({
      where: { id: attendanceId, tenantId: actor.tenantId },
      select: {
        memberId: true,
        status: true,
        overrideReason: true,
        checkedBy: true,
        checkedAt: true,
        memberSubscriptionId: true,
        subscriptionEntitlementId: true,
        session: {
          select: {
            id: true,
            sessionDate: true,
            groupId: true,
            status: true,
            group: { select: { sportId: true } },
          },
        },
        memberSubscription: { select: { plan: { select: { sessionsPerWeek: true } } } },
        subscriptionEntitlement: { select: { sessionsPerWeek: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Présence introuvable" }, { status: 404 });
    }
    if (existing.session.status === "COMPLETED") {
      return NextResponse.json(
        {
          error: "Cette séance est finalisée. Rouvrez-la avant d'annuler un pointage.",
          code: "SESSION_REOPEN_REQUIRED",
        },
        { status: 409 },
      );
    }

    const deleteSessionFailure = sessionMutationFailure(existing.session.status, "annuler");
    if (deleteSessionFailure) {
      return attendancePolicyResponse(deleteSessionFailure);
    }

    const activeSub = await resolveActiveSubscription(existing.memberId, existing.session.group.sportId);
    const planSessionsPerWeek =
      existing.subscriptionEntitlement?.sessionsPerWeek ??
      existing.memberSubscription?.plan.sessionsPerWeek ??
      activeSub?.plan.sessionsPerWeek ??
      null;
    const subscriptionIdForConsumption = existing.memberSubscriptionId ?? activeSub?.id ?? null;

    const creditDelta = await computeAttendanceConsumptionUnits({
      status: existing.status,
      sessionId: existing.session.id,
      groupId: existing.session.groupId,
      sessionDate: existing.session.sessionDate,
      memberId: existing.memberId,
      memberSubscriptionId: subscriptionIdForConsumption,
      planSessionsPerWeek,
      absentConsumesSession: clubSettings.absentConsumesSession,
    });

    await prisma.$transaction(async (tx) => {
      if (creditDelta > 0) {
        await applySessionBalanceDelta(tx, {
          delta: creditDelta,
          memberSubscriptionId: existing.memberSubscriptionId,
          subscriptionEntitlementId: existing.subscriptionEntitlementId,
          memberId: existing.memberId,
          sportId: existing.session.group.sportId,
        });
      }

      await tx.attendance.delete({ where: { id: attendanceId } });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "ATTENDANCE_DELETED",
          entityType: "Attendance",
          entityId: attendanceId,
          userId: actor.id,
          details: JSON.stringify(
            attendanceDeletedAuditDetails({
              tenantId: actor.tenantId,
              deletedAt: new Date(),
              previousStatus: existing.status,
              previous: {
                status: existing.status,
                overrideReason: existing.overrideReason,
                checkedBy: existing.checkedBy,
                checkedAt: existing.checkedAt,
                memberSubscriptionId: existing.memberSubscriptionId,
              },
              memberId: existing.memberId,
              sessionId: existing.session.id,
              memberSubscriptionId: existing.memberSubscriptionId,
              sessionBalanceDelta: creditDelta,
            }),
          ),
        },
      });
    });

    return NextResponse.json({ data: { id: attendanceId } });
  } catch (error) {
    if (isPrismaErrorCode(error, "P2025")) {
      return NextResponse.json({ error: "Présence introuvable" }, { status: 404 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de la suppression" }, { status: 500 });
  }
}
