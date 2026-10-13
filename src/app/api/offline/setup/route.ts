import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { withTenantContext } from "@/lib/tenant-context";
import { isAccountCreationDisabled } from "@/lib/offline-account-policy";

export const runtime = "nodejs";
const setupSchema = z.object({ clubName: z.string().trim().min(2).max(100), name: z.string().trim().min(2).max(80), email: z.string().trim().email(), password: z.string().min(12).max(128) });

export async function POST(request: Request) {
  if (process.env.OFFLINE_DESKTOP !== "1") return NextResponse.json({ error: "Indisponible" }, { status: 404 });
  if (isAccountCreationDisabled()) return NextResponse.json({ error: "La création de comptes est désactivée sur cet ordinateur." }, { status: 403 });
  const parsed = setupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Vérifiez les champs et utilisez un mot de passe d’au moins 12 caractères." }, { status: 400 });
  const tenantId = process.env.OFFLINE_TENANT_ID || "offline-club";
  const passwordHash = await hashPassword(parsed.data.password);
  try {
    await withTenantContext({ tenantId, tenantSlug: "all-in-gym" }, () => prisma.$transaction(async (tx) => {
      if (await tx.user.count({ where: { tenantId } })) throw new Error("ALREADY_CONFIGURED");
      const user = await tx.user.create({ data: { tenantId, name: parsed.data.name, email: parsed.data.email.toLowerCase(), passwordHash, role: "ADMIN", isActive: true } });
      await tx.tenant.update({ where: { id: tenantId }, data: { name: parsed.data.clubName } });
      await tx.clubSettings.update({ where: { tenantId }, data: { clubName: parsed.data.clubName, registrationOnly: false } });
      await tx.auditLog.create({ data: { tenantId, action: "OFFLINE_WORKSPACE_CREATED", entityType: "User", entityId: user.id, userId: user.id } });
    }));
    return NextResponse.json({ data: { configured: true } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_CONFIGURED") return NextResponse.json({ error: "Ce club est déjà configuré." }, { status: 409 });
    throw error;
  }
}
