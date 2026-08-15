import { NextResponse } from "next/server";

import {
  activateDataImportMode,
  deactivateDataImportMode,
  getDataImportMode,
} from "@/lib/data-import-mode";
import {
  applyDataImport,
  dataImportErrorMessage,
  getDataImportRollbackEligibility,
  inspectDataImport,
  rollbackDataImport,
} from "@/lib/data-import-service";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { dataImportPayloadSchema } from "@/lib/schemas/data-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminOrResponse(request: Request) {
  try {
    return { user: await requirePermission(request, "settings.manage"), response: null };
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHENTICATED" ? 401 : 403;
    return { user: null, response: NextResponse.json({ error: "Accès administrateur requis" }, { status }) };
  }
}

export async function GET(request: Request) {
  const auth = await adminOrResponse(request);
  if (!auth.user) return auth.response;
  const tenantId = auth.user.tenantId;

  const [mode, recentImports] = await Promise.all([
    getDataImportMode(auth.user),
    prisma.auditLog.findMany({
      where: { tenantId, action: "DATA_IMPORT_APPLIED" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, entityId: true, details: true, createdAt: true },
    }),
  ]);

  const rolledBack = await prisma.auditLog.findMany({
    where: { tenantId, action: "DATA_IMPORT_ROLLED_BACK" },
    select: { details: true },
  });
  const rolledBackIds = new Set(
    rolledBack.flatMap((row) => {
      try {
        const details = JSON.parse(row.details ?? "{}") as { sourceAuditLogId?: string };
        return details.sourceAuditLogId ? [details.sourceAuditLogId] : [];
      } catch {
        return [];
      }
    }),
  );

  const memberIds = recentImports.map((row) => row.entityId);
  const members = await prisma.member.findMany({
    where: { tenantId, id: { in: memberIds } },
    select: { id: true, firstName: true, lastName: true },
  });
  const names = new Map(members.map((member) => [member.id, `${member.firstName} ${member.lastName}`]));
  const recentImportRows = await Promise.all(
    recentImports.map(async (row) => {
      const rollback = await getDataImportRollbackEligibility(row.id, rolledBackIds);
      return {
        id: row.id,
        memberId: row.entityId,
        memberName: names.get(row.entityId) ?? "Reprise annulée",
        createdAt: row.createdAt.toISOString(),
        canRollback: rollback.canRollback,
        rollbackStatus: rollback.status,
        rollbackReason: rollback.reason,
      };
    }),
  );

  return NextResponse.json({
    data: {
      active: mode.active,
      expiresAt: mode.expiresAt?.toISOString() ?? null,
      recentImports: recentImportRows,
    },
  });
}

export async function POST(request: Request) {
  const auth = await adminOrResponse(request);
  if (!auth.user) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }
  const action =
    typeof body === "object" && body !== null && "action" in body
      ? (body as { action?: unknown }).action
      : null;

  if (action === "activate") {
    const expiresAt = await activateDataImportMode(auth.user);
    await prisma.auditLog.create({
      data: {
        tenantId: auth.user.tenantId,
        action: "DATA_IMPORT_MODE_ACTIVATED",
        entityType: "DataImportMode",
        entityId: auth.user.tenantId,
        userId: auth.user.id,
        details: JSON.stringify({ expiresAt: expiresAt.toISOString() }),
      },
    });
    return NextResponse.json({ data: { active: true, expiresAt: expiresAt.toISOString() } });
  }
  if (action === "deactivate") {
    await deactivateDataImportMode();
    await prisma.auditLog.create({
      data: {
        tenantId: auth.user.tenantId,
        action: "DATA_IMPORT_MODE_DEACTIVATED",
        entityType: "DataImportMode",
        entityId: auth.user.tenantId,
        userId: auth.user.id,
        details: JSON.stringify({ deactivatedAt: new Date().toISOString() }),
      },
    });
    return NextResponse.json({ data: { active: false, expiresAt: null } });
  }

  const mode = await getDataImportMode(auth.user);
  if (!mode.active) {
    return NextResponse.json(
      { error: "Activez d'abord la session temporaire de reprise." },
      { status: 409 },
    );
  }

  if (action === "rollback") {
    const auditLogId =
      typeof body === "object" && body !== null && "auditLogId" in body
        ? (body as { auditLogId?: unknown }).auditLogId
        : null;
    if (typeof auditLogId !== "string" || !auditLogId) {
      return NextResponse.json({ error: "Reprise invalide" }, { status: 400 });
    }
    try {
      await rollbackDataImport(auditLogId, auth.user.id);
      return NextResponse.json({ data: { rolledBack: true } });
    } catch (error) {
      return NextResponse.json({ error: dataImportErrorMessage(error) }, { status: 409 });
    }
  }

  const rawPayload =
    typeof body === "object" && body !== null && "payload" in body
      ? (body as { payload?: unknown }).payload
      : null;
  const parsed = dataImportPayloadSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données de reprise invalides", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    if (action === "preview") {
      const context = await inspectDataImport(parsed.data);
      return NextResponse.json({ data: context.inspection });
    }
    if (action === "apply") {
      const result = await applyDataImport(parsed.data, auth.user.id);
      return NextResponse.json({ data: result }, { status: 201 });
    }
    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: dataImportErrorMessage(error) }, { status: 409 });
  }
}
