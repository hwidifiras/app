import { NextResponse } from "next/server";

import { bulkCreateGroupMembersSchema, bulkDeleteGroupMembersSchema } from "@/lib/schemas/group-member";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { activeAssignmentWindow, checkScheduleConflictForAssignmentWindow } from "@/lib/assignment-policy";
import { checkGroupMemberCompatibility } from "@/lib/demographics";
import {
  IdempotencyKeyConflictError,
  InvalidIdempotencyKeyError,
  idempotencyResponseHeaders,
  readIdempotencyKey,
  replayIdempotentResponse,
  runIdempotentSerializableTransaction,
} from "@/lib/idempotency";

export const runtime = "nodejs";

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

export async function POST(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "enrollment.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = bulkCreateGroupMembersSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const uniqueMemberIds = Array.from(new Set(payload.memberIds));
  let idempotencyKey: string | null;
  try {
    idempotencyKey = readIdempotencyKey(request);
  } catch (error) {
    return idempotencyErrorResponse(error) ?? NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  const idempotencyParams = {
    tenantId: actor.tenantId,
    scope: "group-members:bulk-create",
    idempotencyKey,
    requestPayload: { ...payload, memberIds: uniqueMemberIds },
  };

  try {
    const replay = await replayIdempotentResponse<{ data: Record<string, number | string> }>(idempotencyParams);
    if (replay) {
      return NextResponse.json(replay.response.body, {
        status: replay.response.status,
        headers: idempotencyResponseHeaders(true),
      });
    }

    const result = await runIdempotentSerializableTransaction(idempotencyParams, async (tx) => {
      const assignmentStartDate = new Date(payload.startDate);
      const assignmentEndDate = payload.endDate ? new Date(payload.endDate) : null;
      const now = new Date();
      const group = await tx.group.findFirst({
        where: { id: payload.groupId, tenantId: actor.tenantId },
        select: {
          id: true,
          isActive: true,
          capacity: true,
          groupType: true,
          genderPolicy: true,
          sportId: true,
        },
      });
      if (!group) throw new Error("GROUP_NOT_FOUND");
      if (!group.isActive) throw new Error("GROUP_INACTIVE");

      const [members, existingAssignments, activeCount] = await Promise.all([
        tx.member.findMany({
          where: { tenantId: actor.tenantId, id: { in: uniqueMemberIds } },
          select: { id: true, status: true, memberType: true, gender: true },
        }),
        tx.groupMember.findMany({
          where: {
            tenantId: actor.tenantId,
            groupId: payload.groupId,
            memberId: { in: uniqueMemberIds },
          },
          select: { id: true, memberId: true, status: true },
        }),
        tx.groupMember.count({
          where: {
            tenantId: actor.tenantId,
            groupId: payload.groupId,
            ...activeAssignmentWindow(assignmentStartDate),
          },
        }),
      ]);
      const membersMap = new Map(members.map((item) => [item.id, item]));
      const existingByMemberId = new Map(existingAssignments.map((item) => [item.memberId, item]));
      let availableSlots = Math.max(group.capacity - activeCount, 0);
      let createdCount = 0;
      let reactivatedCount = 0;
      let skippedNotFoundCount = 0;
      let skippedArchivedCount = 0;
      let skippedAlreadyActiveCount = 0;
      let skippedCapacityCount = 0;
      let skippedScheduleConflictCount = 0;
      let skippedTypeMismatchCount = 0;
      let skippedGenderMismatchCount = 0;
      let skippedNoSubscriptionCount = 0;
      let skippedUnpaidSubscriptionCount = 0;
      let skippedSportMismatchCount = 0;
      const createdAssignmentIds: string[] = [];
      const reactivatedAssignmentIds: string[] = [];

      for (const memberId of uniqueMemberIds) {
        const member = membersMap.get(memberId);
        if (!member) {
          skippedNotFoundCount += 1;
          continue;
        }
        if (member.status !== "ACTIVE") {
          skippedArchivedCount += 1;
          continue;
        }

        const compatibility = checkGroupMemberCompatibility({
          groupType: group.groupType,
          genderPolicy: group.genderPolicy,
          memberType: member.memberType,
          gender: member.gender,
        });
        if (!compatibility.ok) {
          if (compatibility.code === "GENDER_POLICY_MISMATCH") skippedGenderMismatchCount += 1;
          else skippedTypeMismatchCount += 1;
          continue;
        }

        const activeSub = await tx.memberSubscription.findFirst({
          where: {
            tenantId: actor.tenantId,
            memberId,
            sportId: group.sportId,
            status: "ACTIVE",
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }],
            remainingSessions: { gt: 0 },
          },
          select: {
            amount: true,
            payments: { select: { amount: true } },
            plan: { select: { sportId: true } },
          },
          orderBy: { endDate: "asc" },
        });
        if (!activeSub) {
          skippedNoSubscriptionCount += 1;
          continue;
        }
        if (activeSub.payments.reduce((sum, payment) => sum + payment.amount, 0) < activeSub.amount) {
          skippedUnpaidSubscriptionCount += 1;
          continue;
        }
        if (activeSub.plan.sportId && activeSub.plan.sportId !== group.sportId) {
          skippedSportMismatchCount += 1;
          continue;
        }

        const existing = existingByMemberId.get(memberId);
        if (existing?.status === "ACTIVE") {
          skippedAlreadyActiveCount += 1;
          continue;
        }
        const scheduleCheck = await checkScheduleConflictForAssignmentWindow(
          payload.groupId,
          memberId,
          assignmentStartDate,
          assignmentEndDate,
          undefined,
          tx,
        );
        if (!scheduleCheck.ok) {
          skippedScheduleConflictCount += 1;
          continue;
        }
        if (availableSlots <= 0) {
          skippedCapacityCount += 1;
          continue;
        }

        if (existing) {
          const updated = await tx.groupMember.update({
            where: { id: existing.id },
            data: { status: "ACTIVE", startDate: assignmentStartDate, endDate: assignmentEndDate },
          });
          reactivatedCount += 1;
          reactivatedAssignmentIds.push(updated.id);
        } else {
          const created = await tx.groupMember.create({
            data: {
              tenantId: actor.tenantId,
              groupId: payload.groupId,
              memberId,
              startDate: assignmentStartDate,
              endDate: assignmentEndDate,
              status: "ACTIVE",
            },
          });
          createdCount += 1;
          createdAssignmentIds.push(created.id);
        }
        availableSlots -= 1;
      }

      if (createdCount > 0 || reactivatedCount > 0) {
        await tx.auditLog.create({
          data: {
            tenantId: actor.tenantId,
            action: "GROUP_MEMBERS_ASSIGNED",
            entityType: "GroupMember",
            entityId: payload.groupId,
            userId: actor.id,
            details: JSON.stringify({
              groupId: payload.groupId,
              tenantId: actor.tenantId,
              requestedMemberIds: uniqueMemberIds,
              createdAssignmentIds,
              reactivatedAssignmentIds,
              startDate: assignmentStartDate.toISOString(),
              endDate: assignmentEndDate?.toISOString() ?? null,
              skipped: {
                notFound: skippedNotFoundCount,
                archived: skippedArchivedCount,
                alreadyActive: skippedAlreadyActiveCount,
                capacity: skippedCapacityCount,
                scheduleConflict: skippedScheduleConflictCount,
                typeMismatch: skippedTypeMismatchCount,
                genderMismatch: skippedGenderMismatchCount,
                noSubscription: skippedNoSubscriptionCount,
                unpaidSubscription: skippedUnpaidSubscriptionCount,
                sportMismatch: skippedSportMismatchCount,
              },
            }),
          },
        });
      }

      return {
        status: 200,
        body: {
          data: {
            groupId: payload.groupId,
            requestedCount: uniqueMemberIds.length,
            createdCount,
            reactivatedCount,
            skippedNotFoundCount,
            skippedArchivedCount,
            skippedAlreadyActiveCount,
            skippedCapacityCount,
            skippedScheduleConflictCount,
            skippedTypeMismatchCount,
            skippedGenderMismatchCount,
            skippedNoSubscriptionCount,
            skippedUnpaidSubscriptionCount,
            skippedSportMismatchCount,
          },
        },
      };
    });

    return NextResponse.json(result.response.body, {
      status: result.response.status,
      headers: idempotencyResponseHeaders(result.replayed),
    });
  } catch (error) {
    const idempotencyResponse = idempotencyErrorResponse(error);
    if (idempotencyResponse) return idempotencyResponse;
    if (error instanceof Error && error.message === "GROUP_NOT_FOUND") {
      return NextResponse.json({ error: "Groupe introuvable" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "GROUP_INACTIVE") {
      return NextResponse.json({ error: "Impossible d'affecter un groupe inactif" }, { status: 409 });
    }
    console.error("[POST /api/group-members/bulk]", error);
    return NextResponse.json({ error: "Erreur serveur lors de l'affectation multiple" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let actor;
  try {
    actor = await requirePermission(request, "enrollment.manage");
  } catch (e) {
    return jsonAuthFailureResponse(e);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = bulkDeleteGroupMembersSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const uniqueMemberIds = Array.from(new Set(payload.memberIds));
  let idempotencyKey: string | null;
  try {
    idempotencyKey = readIdempotencyKey(request);
  } catch (error) {
    return idempotencyErrorResponse(error) ?? NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  const idempotencyParams = {
    tenantId: actor.tenantId,
    scope: "group-members:bulk-close",
    idempotencyKey,
    requestPayload: { ...payload, memberIds: uniqueMemberIds },
  };

  try {
    const replay = await replayIdempotentResponse<{
      data: { groupId: string; requestedCount: number; closedCount: number };
    }>(idempotencyParams);
    if (replay) {
      return NextResponse.json(replay.response.body, {
        status: replay.response.status,
        headers: idempotencyResponseHeaders(true),
      });
    }

    const result = await runIdempotentSerializableTransaction(idempotencyParams, async (tx) => {
      const now = new Date();
      const closed = await tx.groupMember.updateMany({
        where: {
          tenantId: actor.tenantId,
          groupId: payload.groupId,
          memberId: { in: uniqueMemberIds },
          status: "ACTIVE",
        },
        data: { status: "INACTIVE", endDate: now },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          action: "GROUP_MEMBERS_CLOSED",
          entityType: "GroupMember",
          entityId: payload.groupId,
          userId: actor.id,
          details: JSON.stringify({
            tenantId: actor.tenantId,
            memberIds: uniqueMemberIds,
            closedAt: now.toISOString(),
            closedCount: closed.count,
          }),
        },
      });

      return {
        status: 200,
        body: {
          data: {
            groupId: payload.groupId,
            requestedCount: uniqueMemberIds.length,
            closedCount: closed.count,
          },
        },
      };
    });

    return NextResponse.json(result.response.body, {
      status: result.response.status,
      headers: idempotencyResponseHeaders(result.replayed),
    });
  } catch (error) {
    const idempotencyResponse = idempotencyErrorResponse(error);
    if (idempotencyResponse) return idempotencyResponse;
    console.error("[DELETE /api/group-members/bulk]", error);
    return NextResponse.json({ error: "Erreur serveur lors du retrait multiple" }, { status: 500 });
  }
}
