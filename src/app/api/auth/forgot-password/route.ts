import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  buildResetUrl,
  createPasswordResetToken,
  sendPasswordResetEmail,
} from "@/lib/password-reset";

export const runtime = "nodejs";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation échouée", details: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { id: true, email: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ data: { ok: true } });
  }

  const { token } = await createPasswordResetToken(user.id);
  const origin = new URL(request.url).origin;
  const resetUrl = buildResetUrl(token, origin);
  const delivery = await sendPasswordResetEmail(user.email, resetUrl);

  await prisma.auditLog.create({
    data: {
      action: "PASSWORD_RESET_REQUESTED",
      entityType: "User",
      entityId: user.id,
      details: JSON.stringify({ delivered: delivery.delivered }),
    },
  });

  return NextResponse.json({
    data: {
      ok: true,
      emailConfigured: delivery.delivered,
      resetUrl: process.env.NODE_ENV === "production" || delivery.delivered ? undefined : resetUrl,
      emailError: delivery.delivered ? undefined : delivery.reason,
    },
  });
}
