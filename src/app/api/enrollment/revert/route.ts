import { NextResponse } from "next/server";

import {
  EnrollmentRevertBlockedError,
  enrollmentUndoSnapshotSchema,
  revertEnrollmentUndoSnapshot,
  type EnrollmentUndoSnapshot,
} from "@/lib/enrollment-undo";
import { getEnrollmentRecoveryByKey, isEnrollmentRecoveryVoided } from "@/lib/enrollment-recovery";
import { prisma } from "@/lib/prisma";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";

export const runtime = "nodejs";

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

  const reason =
    typeof body === "object" && body !== null && "reason" in body
      ? String((body as { reason?: unknown }).reason ?? "").trim()
      : "";

  if (reason.length < 3) {
    return NextResponse.json({ error: "Motif obligatoire pour annuler une inscription" }, { status: 400 });
  }

  let snapshot: EnrollmentUndoSnapshot | null = null;
  let recoveryKey: string | null = null;
  let memberIds: string[] | undefined;

  const payload = typeof body === "object" && body !== null ? body as { undoSnapshot?: unknown; recoveryKey?: unknown } : {};
  if (typeof payload.recoveryKey === "string" && payload.recoveryKey.trim()) {
    recoveryKey = payload.recoveryKey.trim();
    const recovery = await getEnrollmentRecoveryByKey(recoveryKey, actor.tenantId);
    if (!recovery) {
      return NextResponse.json({ error: "Inscription récupérable introuvable" }, { status: 404 });
    }
    if (await isEnrollmentRecoveryVoided(recoveryKey, actor.tenantId)) {
      return NextResponse.json({ error: "Cette inscription a déjà été annulée avec trace" }, { status: 409 });
    }
    snapshot = recovery.undoSnapshot;
    memberIds = recovery.memberIds;
  } else {
    const parsed = enrollmentUndoSnapshotSchema.safeParse(
      "undoSnapshot" in payload ? payload.undoSnapshot : body,
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation échouée", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    snapshot = parsed.data;
  }

  if (!snapshot) {
    return NextResponse.json({ error: "Inscription récupérable introuvable" }, { status: 404 });
  }
  const undoSnapshot = snapshot;

  try {
    await prisma.$transaction(async (tx) => {
      await revertEnrollmentUndoSnapshot(tx, undoSnapshot, actor.id, reason, {
        tenantId: actor.tenantId,
        recoveryKey,
        memberIds,
      });
    });

    return NextResponse.json({ data: { voided: true } });
  } catch (error) {
    if (error instanceof EnrollmentRevertBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error("[POST /api/enrollment/revert]", error);
    return NextResponse.json({ error: "Erreur lors de l'annulation de l'inscription" }, { status: 500 });
  }
}
