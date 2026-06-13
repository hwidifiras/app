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
} from "@/lib/membership-rules";

export const runtime = "nodejs";

function getThirtyDaysAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function countOverrides(memberId: string): Promise<number> {
  const thirtyDaysAgo = getThirtyDaysAgo();
  return prisma.attendance.count({
    where: {
      memberId,
      status: "OVERRIDE",
      checkedAt: { gte: thirtyDaysAgo },
    },
  });
}

export async function GET(request: Request) {
  try {
    await requirePermission(request, "attendance.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId")?.trim();
  const memberId = searchParams.get("memberId")?.trim();

  const attendances = await prisma.attendance.findMany({
    where: {
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
  let actor;
  try {
    actor = await requirePermission(request, "attendance.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

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
    const sessionExists = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        group: { select: { id: true, sportId: true, groupType: true } },
      },
    });
    if (!sessionExists) {
      return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
    }

    const memberExists = await prisma.member.findUnique({ where: { id: memberId } });
    if (!memberExists) {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }

    if (memberExists.status === "ARCHIVED") {
      return NextResponse.json({ error: "Impossible de pointer un membre résilié" }, { status: 403 });
    }

    const sportId = sessionExists.group.sportId;
    const activeSub = await resolveActiveSubscription(memberId, sportId);
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
      const assignment = await prisma.groupMember.findFirst({
        where: { groupId: sessionExists.group.id, memberId, status: "ACTIVE" }
      });

      if (!assignment) {
        return NextResponse.json(
          {
            error: "Le membre n'est pas assigné à ce groupe — passage exceptionnel requis",
            code: "NOT_ASSIGNED_TO_GROUP",
          },
          { status: 403 }
        );
      }

      if (!isSubActive) {
        return NextResponse.json(
          {
            error: "Abonnement inactif — passage exceptionnel requis",
            code: "SUBSCRIPTION_INACTIVE",
          },
          { status: 403 },
        );
      }

      const payCheck = await canCheckInWithPayment(activeSub);
      if (!payCheck.allowed) {
        return NextResponse.json(
          {
            error: payCheck.reason ?? "Abonnement non payé — passage exceptionnel requis",
            code: "SUBSCRIPTION_UNPAID",
          },
          { status: 403 },
        );
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

      const overrideCount = await countOverrides(memberId);

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

      if (consumptionUnits > 0) {
        if (isSubActive && activeSub) {
          remainingSessionsBefore = activeSub.remainingSessions;

          const updated = await tx.memberSubscription.updateMany({
            where: {
              id: activeSub.id,
              remainingSessions: { gt: 0 },
            },
            data: { remainingSessions: { decrement: consumptionUnits } },
          });

          if (updated.count === 0) {
            throw new Error("NO_SESSIONS_LEFT");
          }
        }
      }

      const attendance = await tx.attendance.create({
        data: {
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
          action: "ATTENDANCE_CREATED",
          entityType: "Attendance",
          entityId: attendance.id,
          userId: actor.id,
          details: JSON.stringify({
            sessionId,
            memberId,
            status,
            sportId,
            overrideReason: normalizedOverrideReason,
            subscriptionActive: isSubActive,
            overrideKind: isRecoveryOverride ? "RECOVERY" : overrideKind ?? "STANDARD",
            remainingSessionsBefore,
          }),
        },
      });

      return attendance;
    });

    return NextResponse.json(
      {
        data: result,
        warning:
          status === "OVERRIDE" && (await countOverrides(memberId)) >= 2
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

    const isDuplicate =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002";

    if (isDuplicate) {
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
  let actor;
  try {
    actor = await requirePermission(request, "attendance.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("attendanceId" in body)) {
    return NextResponse.json({ error: "attendanceId requis" }, { status: 400 });
  }

  const attendanceId = (body as { attendanceId?: unknown }).attendanceId;

  if (typeof attendanceId !== "string" || attendanceId.trim().length === 0) {
    return NextResponse.json({ error: "attendanceId invalide" }, { status: 400 });
  }

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
    const existing = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      select: {
        memberId: true,
        status: true,
        memberSubscriptionId: true,
        session: {
          select: {
            id: true,
            sessionDate: true,
            groupId: true,
            group: { select: { sportId: true } },
          },
        },
        memberSubscription: { select: { plan: { select: { sessionsPerWeek: true } } } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Présence introuvable" }, { status: 404 });
    }

    const activeSub = await resolveActiveSubscription(existing.memberId, existing.session.group.sportId);
    const planSessionsPerWeek =
      existing.memberSubscription?.plan.sessionsPerWeek ?? activeSub?.plan.sessionsPerWeek ?? null;
    const subscriptionIdForConsumption = existing.memberSubscriptionId ?? activeSub?.id ?? null;

    const nextStatus = payload.status ?? existing.status;

    if (nextStatus === "OVERRIDE" && nextStatus !== existing.status) {
      const overrideCount = await countOverrides(existing.memberId);
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

    const updated = await prisma.$transaction(async (tx) => {
      let memberSubscriptionId = existing.memberSubscriptionId;

      if (delta !== 0) {
        const adjustment = await applySessionBalanceDelta(tx, {
          delta,
          memberSubscriptionId,
          memberId: existing.memberId,
          sportId: existing.session.group.sportId,
        });
        memberSubscriptionId = adjustment.memberSubscriptionId;
      }

      return tx.attendance.update({
        where: { id: attendanceId },
        data: {
          status: payload.status,
          memberSubscriptionId:
            payload.status !== undefined && nextStatus !== "OVERRIDE"
              ? memberSubscriptionId ?? subscriptionIdForConsumption
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
    });

    await prisma.auditLog.create({
      data: {
        action: "ATTENDANCE_UPDATED",
        entityType: "Attendance",
        entityId: attendanceId,
        userId: actor?.id ?? null,
        details: JSON.stringify({
          oldStatus: existing.status,
          newStatus: payload.status ?? existing.status,
          overrideReason: payload.overrideReason || null,
          sessionBalanceDelta: delta,
        }),
      },
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
    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025";

    if (isNotFound) {
      return NextResponse.json({ error: "Présence introuvable" }, { status: 404 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de la modification" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "attendance.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("attendanceId" in body)) {
    return NextResponse.json({ error: "attendanceId requis" }, { status: 400 });
  }

  const attendanceId = (body as { attendanceId?: unknown }).attendanceId;

  if (typeof attendanceId !== "string" || attendanceId.trim().length === 0) {
    return NextResponse.json({ error: "attendanceId invalide" }, { status: 400 });
  }

  try {
    const clubSettings = await getClubSettings();
    const existing = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      select: {
        memberId: true,
        status: true,
        memberSubscriptionId: true,
        session: {
          select: {
            id: true,
            sessionDate: true,
            groupId: true,
            group: { select: { sportId: true } },
          },
        },
        memberSubscription: { select: { plan: { select: { sessionsPerWeek: true } } } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Présence introuvable" }, { status: 404 });
    }

    const activeSub = await resolveActiveSubscription(existing.memberId, existing.session.group.sportId);
    const planSessionsPerWeek =
      existing.memberSubscription?.plan.sessionsPerWeek ?? activeSub?.plan.sessionsPerWeek ?? null;
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
          memberId: existing.memberId,
          sportId: existing.session.group.sportId,
        });
      }

      await tx.attendance.delete({ where: { id: attendanceId } });
    });

    await prisma.auditLog.create({
      data: {
        action: "ATTENDANCE_DELETED",
        entityType: "Attendance",
        entityId: attendanceId,
        userId: actor?.id ?? null,
        details: JSON.stringify({
          deletedAt: new Date().toISOString(),
          previousStatus: existing.status,
          sessionBalanceDelta: creditDelta,
        }),
      },
    });

    return NextResponse.json({ data: { id: attendanceId } });
  } catch (error) {
    const isNotFound =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025";

    if (isNotFound) {
      return NextResponse.json({ error: "Présence introuvable" }, { status: 404 });
    }

    return NextResponse.json({ error: "Erreur serveur lors de la suppression" }, { status: 500 });
  }
}
