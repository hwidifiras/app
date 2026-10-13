import { NextResponse } from "next/server";
import { requirePermission, jsonAuthFailureResponse } from "@/lib/permissions";
import { withTenantContext } from "@/lib/tenant-context";
import { runSerializableTransaction } from "@/lib/serializable-transaction";

export async function POST(request: Request) {
  if (process.env.OFFLINE_DESKTOP !== "1") return NextResponse.json({ error: "Édition locale requise." }, { status: 404 });
  let user;
  try { user = await requirePermission(request, "settings.manage"); if (user.role !== "ADMIN") throw new Error("FORBIDDEN"); }
  catch (error) { return jsonAuthFailureResponse(error); }
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Choix invalide." }, { status: 400 }); }
  const moduleKey = body.moduleKey;
  if (!["CLASS_MANAGEMENT", "GYM_ACCESS"].includes(moduleKey)) return NextResponse.json({ error: "Module invalide." }, { status: 400 });
  return withTenantContext({ tenantId: user.tenantId, tenantSlug: user.tenantSlug }, async () => {
    const data = await runSerializableTransaction(async (tx) => {
      const tenantModule = await tx.tenantModule.upsert({ where: { tenantId_moduleKey: { tenantId: user.tenantId, moduleKey } }, create: { tenantId: user.tenantId, moduleKey, status: "ENABLED", enabledAt: new Date(), grantSource: "MANUAL" }, update: { status: "ENABLED", enabledAt: new Date(), disabledAt: null, grantSource: "MANUAL", saasSubscriptionId: null } });
      await tx.auditLog.create({ data: { tenantId: user.tenantId, userId: user.id, action: "OFFLINE_MODULE_ENABLED", entityType: "TenantModule", entityId: tenantModule.id, details: JSON.stringify({ moduleKey }) } });
      return { moduleKey, status: "ENABLED" };
    });
    return NextResponse.json({ data });
  });
}
