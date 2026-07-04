import { NextResponse } from "next/server";
import { z } from "zod";

import {
  buildResetUrl,
  createPasswordResetToken,
  sendPasswordResetEmail,
} from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { enterTenantContext } from "@/lib/tenant-context";
import { resolveTenantFromRequest } from "@/lib/tenant-resolver";

export const runtime = "nodejs";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

const FORGOT_PASSWORD_LIMIT = 5;
const FORGOT_PASSWORD_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const tenant = await resolveTenantFromRequest(request);
  const tenantRateKey = tenant.ok ? tenant.context.tenantSlug : "unknown";
  const rateLimit = checkRateLimit(
    `forgot-password:${tenantRateKey}:${getClientIp(request)}`,
    FORGOT_PASSWORD_LIMIT,
    FORGOT_PASSWORD_WINDOW_MS,
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Trop de demandes. Reessayez dans quelques minutes." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  if (!tenant.ok) {
    return NextResponse.json({ data: { ok: true } });
  }
  enterTenantContext(tenant.context);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation echouee", details: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.context.tenantId, email: parsed.data.email.toLowerCase() },
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
      tenantId: tenant.context.tenantId,
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
