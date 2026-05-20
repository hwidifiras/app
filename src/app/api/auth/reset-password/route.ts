import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { hashResetToken } from "@/lib/password-reset";

export const runtime = "nodejs";

const resetPasswordSchema = z.object({
  token: z.string().trim().min(32),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation échouée", details: parsed.error.flatten() }, { status: 400 });
  }

  const tokenHash = hashResetToken(parsed.data.token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, isActive: true } } },
  });

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt < new Date() ||
    !resetToken.user.isActive
  ) {
    return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 400 });
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
        action: "PASSWORD_RESET_COMPLETED",
        entityType: "User",
        entityId: resetToken.userId,
      },
    }),
  ]);

  return NextResponse.json({ data: { ok: true } });
}
