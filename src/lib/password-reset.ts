import { createHash, randomBytes } from "node:crypto";

import { runSerializableTransaction } from "@/lib/serializable-transaction";
import { getRequiredTenantId } from "@/lib/tenant-context";

const RESET_TTL_MINUTES = 60;

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildResetUrl(token: string, origin?: string): string {
  // A reset token is tenant-scoped, so a validated request origin must win over
  // the platform fallback or the link can land on another tenant's hostname.
  const baseUrl = origin || process.env.APP_URL?.trim() || "http://localhost:3000";
  const url = new URL("/reset-password", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function createPasswordResetToken(userId: string) {
  const tenantId = getRequiredTenantId();
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

  await runSerializableTransaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { id: userId, tenantId, isActive: true },
      select: { id: true },
    });
    if (!user) {
      throw new Error("PASSWORD_RESET_USER_UNAVAILABLE");
    }

    await tx.passwordResetToken.updateMany({
      where: { tenantId, userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    await tx.passwordResetToken.create({
      data: { tenantId, userId, tokenHash, expiresAt },
    });
  });

  return { token, expiresAt };
}

export { sendPasswordResetEmail } from "@/lib/email";
