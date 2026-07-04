import { NextResponse } from "next/server";
import { z } from "zod";

import { hashPassword } from "@/lib/password";
import { hashResetToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { enterTenantContext } from "@/lib/tenant-context";
import { resolveTenantFromRequest } from "@/lib/tenant-resolver";

export const runtime = "nodejs";

const resetPasswordSchema = z.object({
  token: z.string().trim().min(32),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const tenant = await resolveTenantFromRequest(request);
  if (!tenant.ok) {
    return NextResponse.json({ error: "Lien invalide ou expire" }, { status: 400 });
  }
  enterTenantContext(tenant.context);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation echouee", details: parsed.error.flatten() }, { status: 400 });
  }

  const tokenHash = hashResetToken(parsed.data.token);
  const resetToken = await prisma.passwordResetToken.findFirst({
    where: { tenantId: tenant.context.tenantId, tokenHash },
    include: { user: { select: { id: true, isActive: true } } },
  });

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt < new Date() ||
    !resetToken.user.isActive
  ) {
    return NextResponse.json({ error: "Lien invalide ou expire" }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        tenantId: tenant.context.tenantId,
        action: "PASSWORD_RESET_COMPLETED",
        entityType: "User",
        entityId: resetToken.userId,
      },
    }),
  ]);

  return NextResponse.json({ data: { ok: true } });
}
