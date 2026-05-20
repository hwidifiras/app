import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  buildResetUrl,
  createPasswordResetToken,
  sendPasswordResetEmail,
} from "@/lib/password-reset";
import { requireAdmin } from "@/lib/request-user";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch (e) {
    const code = e instanceof Error ? e.message : "FORBIDDEN";
    return NextResponse.json(
      { error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé" },
      { status: code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }

  const { id } = await context.params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, isActive: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  if (!user.isActive) {
    return NextResponse.json({ error: "Ce compte est désactivé" }, { status: 400 });
  }

  const { token } = await createPasswordResetToken(user.id);
  const origin = new URL(request.url).origin;
  const resetUrl = buildResetUrl(token, origin);
  const delivery = await sendPasswordResetEmail(user.email, resetUrl);

  await prisma.auditLog.create({
    data: {
      action: "PASSWORD_RESET_SENT_BY_ADMIN",
      entityType: "User",
      entityId: user.id,
      userId: admin.id,
      details: JSON.stringify({ delivered: delivery.delivered, reason: delivery.delivered ? null : delivery.reason }),
    },
  });

  return NextResponse.json({
    data: {
      ok: true,
      emailConfigured: delivery.delivered,
      resetUrl: process.env.NODE_ENV === "production" ? undefined : resetUrl,
    },
  });
}
