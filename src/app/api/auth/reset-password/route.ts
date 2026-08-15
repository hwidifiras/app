import { NextResponse } from "next/server";
import { z } from "zod";

import { hashPassword } from "@/lib/password";
import { hashResetToken } from "@/lib/password-reset";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { runSerializableTransaction } from "@/lib/serializable-transaction";
import { enterTenantContext } from "@/lib/tenant-context";
import { resolveTenantFromRequest } from "@/lib/tenant-resolver";

export const runtime = "nodejs";

const RESET_PASSWORD_LIMIT = 5;
const RESET_PASSWORD_WINDOW_MS = 15 * 60 * 1000;

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

  const rateLimit = await checkRateLimit(
    `reset-password:${tenant.context.tenantSlug}:${getClientIp(request)}`,
    RESET_PASSWORD_LIMIT,
    RESET_PASSWORD_WINDOW_MS,
  );
  if (!rateLimit.allowed) {
    if (rateLimit.reason === "unavailable") {
      return NextResponse.json(
        { error: "Service de reinitialisation temporairement indisponible." },
        { status: 503, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }
    return NextResponse.json(
      { error: "Trop de tentatives. Reessayez dans quelques minutes." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

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
  const passwordHash = await hashPassword(parsed.data.password);

  try {
    await runSerializableTransaction(async (tx) => {
      const now = new Date();
      const tokenUpdate = await tx.passwordResetToken.updateMany({
        where: {
          tenantId: tenant.context.tenantId,
          tokenHash,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });
      if (tokenUpdate.count !== 1) {
        throw new Error("PASSWORD_RESET_TOKEN_INVALID");
      }

      const resetToken = await tx.passwordResetToken.findFirst({
        where: { tenantId: tenant.context.tenantId, tokenHash },
        select: { userId: true },
      });
      if (!resetToken) {
        throw new Error("PASSWORD_RESET_TOKEN_INVALID");
      }

      const userUpdate = await tx.user.updateMany({
        where: { id: resetToken.userId, tenantId: tenant.context.tenantId, isActive: true },
        data: { passwordHash },
      });
      if (userUpdate.count !== 1) {
        throw new Error("PASSWORD_RESET_SCOPE_MISMATCH");
      }
      await tx.auditLog.create({
        data: {
          tenantId: tenant.context.tenantId,
          action: "PASSWORD_RESET_COMPLETED",
          entityType: "User",
          entityId: resetToken.userId,
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "PASSWORD_RESET_SCOPE_MISMATCH" || error.message === "PASSWORD_RESET_TOKEN_INVALID")
    ) {
      return NextResponse.json({ error: "Lien invalide ou expire" }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({ data: { ok: true } });
}
