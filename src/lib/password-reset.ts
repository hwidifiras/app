import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

const RESET_TTL_MINUTES = 60;

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function buildResetUrl(token: string, origin?: string): string {
  const baseUrl = process.env.APP_URL?.trim() || origin || "http://localhost:3000";
  const url = new URL("/reset-password", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function createPasswordResetToken(userId: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return { token, expiresAt };
}

export { sendPasswordResetEmail } from "@/lib/email";
