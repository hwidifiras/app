import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import {
  IdempotencyKeyConflictError,
  InvalidIdempotencyKeyError,
  idempotencyResponseHeaders,
  readIdempotencyKey,
  runIdempotentSerializableTransaction,
} from "@/lib/idempotency";
import {
  deriveSessionLifecycle,
  expectedMemberIdsAtSession,
} from "@/lib/session-lifecycle";

export const runtime = "nodejs";

const actionSchema = z.object({
  action: z.enum(["finalize", "reopen"]),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

type SessionFinalizationResponse = {
  data: { id: string; status: "PLANNED" | "RESCHEDULED" | "COMPLETED" };
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let actor;
  try {
    actor = await requirePermission(request, "attendance.manage");
  } catch (error) {
    return jsonAuthFailureResponse(error);
  }

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  }

  const { id } = await params;
  const reason =
    parsed.data.reason?.trim() ||
    (parsed.data.action === "reopen" ? "Correction du pointage" : "Finalisation du pointage");
  let idempotencyKey: string | null;
  try {
    idempotencyKey = readIdempotencyKey(request);
  } catch (error) {
    if (error instanceof InvalidIdempotencyKeyError) {
      return NextResponse.json({ error: "Clé d'idempotence invalide" }, { status: 400 });
    }
    throw error;
  }

  try {
    const result = await runIdempotentSerializableTransaction<SessionFinalizationResponse>(
      {
        tenantId: actor.tenantId,
        scope: `sessions:${id}:finalization`,
        idempotencyKey,
        requestPayload: parsed.data,
      },
      async (tx) => {
        const session = await tx.session.findFirst({
          where: { id, tenantId: actor.tenantId },
          include: {
            group: {
              select: {
                members: {
                  select: {
                    memberId: true,
                    status: true,
                    startDate: true,
                    endDate: true,
                    member: { select: { status: true } },
                  },
                },
              },
            },
            attendances: { select: { memberId: true } },
          },
        });
        if (!session) throw new Error("SESSION_NOT_FOUND");

        if (parsed.data.action === "reopen") {
          if (session.status !== "COMPLETED") throw new Error("SESSION_NOT_COMPLETED");

          const completionLog = await tx.auditLog.findFirst({
            where: {
              tenantId: actor.tenantId,
              action: "SESSION_COMPLETED",
              entityType: "Session",
              entityId: id,
            },
            orderBy: { createdAt: "desc" },
            select: { details: true },
          });
          let reopenedStatus: "PLANNED" | "RESCHEDULED" = "PLANNED";
          try {
            const details = JSON.parse(completionLog?.details ?? "{}") as { previousStatus?: string };
            if (details.previousStatus === "RESCHEDULED") reopenedStatus = "RESCHEDULED";
          } catch {
            // Older completion logs did not store the previous status.
          }

          const updateResult = await tx.session.updateMany({
            where: { id, tenantId: actor.tenantId, status: "COMPLETED" },
            data: { status: reopenedStatus },
          });
          if (updateResult.count !== 1) throw new Error("SESSION_STATE_CHANGED");

          await tx.auditLog.create({
            data: {
              tenantId: actor.tenantId,
              action: "SESSION_REOPENED",
              entityType: "Session",
              entityId: id,
              userId: actor.id,
              details: JSON.stringify({
                tenantId: actor.tenantId,
                previousStatus: "COMPLETED",
                reopenedStatus,
                attendanceCount: session.attendances.length,
                reason,
              }),
            },
          });
          return { status: 200, body: { data: { id, status: reopenedStatus } } };
        }

        if (session.status === "CANCELLED") throw new Error("SESSION_CANCELLED");
        if (session.status === "COMPLETED") {
          return { status: 200, body: { data: { id: session.id, status: session.status } } };
        }

        const lifecycle = deriveSessionLifecycle({
          status: session.status,
          sessionDate: session.sessionDate,
          endTime: session.endTime,
          expectedMemberIds: expectedMemberIdsAtSession(session.group.members, session.sessionDate),
          attendanceMemberIds: session.attendances.map((attendance) => attendance.memberId),
        });
        if (!lifecycle.ended) throw new Error("SESSION_NOT_ENDED");
        if (!lifecycle.canFinalize) {
          throw new Error(`SESSION_ATTENDANCE_INCOMPLETE:${lifecycle.unmarkedCount}`);
        }

        const updateResult = await tx.session.updateMany({
          where: { id, tenantId: actor.tenantId, status: session.status },
          data: { status: "COMPLETED" },
        });
        if (updateResult.count !== 1) throw new Error("SESSION_STATE_CHANGED");

        await tx.auditLog.create({
          data: {
            tenantId: actor.tenantId,
            action: "SESSION_COMPLETED",
            entityType: "Session",
            entityId: id,
            userId: actor.id,
            details: JSON.stringify({
              tenantId: actor.tenantId,
              expectedMemberCount: lifecycle.expectedMemberCount,
              checkedMemberCount: lifecycle.checkedMemberCount,
              previousStatus: session.status,
              reason,
            }),
          },
        });
        return { status: 200, body: { data: { id, status: "COMPLETED" as const } } };
      },
    );

    return NextResponse.json(result.response.body, {
      status: result.response.status,
      headers: idempotencyResponseHeaders(result.replayed),
    });
  } catch (error) {
    if (error instanceof IdempotencyKeyConflictError) {
      return NextResponse.json(
        { error: "Cette clé d'idempotence a déjà servi pour une autre requête" },
        { status: 409 },
      );
    }
    if (error instanceof Error) {
      if (error.message === "SESSION_NOT_FOUND") {
        return NextResponse.json({ error: "Séance introuvable" }, { status: 404 });
      }
      if (error.message === "SESSION_NOT_COMPLETED") {
        return NextResponse.json({ error: "Cette séance n'est pas finalisée" }, { status: 409 });
      }
      if (error.message === "SESSION_CANCELLED") {
        return NextResponse.json({ error: "Une séance annulée ne peut pas être finalisée" }, { status: 409 });
      }
      if (error.message === "SESSION_NOT_ENDED") {
        return NextResponse.json(
          { error: "La séance ne peut être finalisée qu'après son heure de fin" },
          { status: 409 },
        );
      }
      if (error.message.startsWith("SESSION_ATTENDANCE_INCOMPLETE:")) {
        const unmarkedCount = Number(error.message.split(":")[1] ?? 0);
        return NextResponse.json(
          {
            error: `${unmarkedCount} membre${unmarkedCount > 1 ? "s" : ""} reste${unmarkedCount > 1 ? "nt" : ""} à pointer`,
            code: "SESSION_ATTENDANCE_INCOMPLETE",
            unmarkedCount,
          },
          { status: 409 },
        );
      }
      if (error.message === "SESSION_STATE_CHANGED") {
        return NextResponse.json(
          { error: "La séance a été modifiée. Actualisez puis réessayez." },
          { status: 409 },
        );
      }
    }

    console.error("[POST /api/attendances/sessions/:id/finalize]", error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour de la séance" }, { status: 500 });
  }
}
