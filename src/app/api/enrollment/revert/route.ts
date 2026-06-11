import { NextResponse } from "next/server";

import {
  EnrollmentRevertBlockedError,
  enrollmentUndoSnapshotSchema,
  revertEnrollmentUndoSnapshot,
} from "@/lib/enrollment-undo";
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

  const parsed = enrollmentUndoSnapshotSchema.safeParse(
    typeof body === "object" && body !== null && "undoSnapshot" in body
      ? (body as { undoSnapshot: unknown }).undoSnapshot
      : body,
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation échouée", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await revertEnrollmentUndoSnapshot(tx, parsed.data, actor.id);
    });

    return NextResponse.json({ data: { reverted: true } });
  } catch (error) {
    if (error instanceof EnrollmentRevertBlockedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error("[POST /api/enrollment/revert]", error);
    return NextResponse.json({ error: "Erreur lors de l'annulation de l'inscription" }, { status: 500 });
  }
}
