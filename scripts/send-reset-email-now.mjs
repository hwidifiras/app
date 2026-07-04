/**
 * Send a real password-reset email using dev DB + .env.development.
 * Usage: TENANT_SLUG=we-discipline node scripts/with-dev-env.mjs scripts/send-reset-email-now.mjs <email>
 */
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";

const email = (process.argv[2] ?? "").trim().toLowerCase();
const tenantSlug = process.env.TENANT_SLUG?.trim() || process.env.DEFAULT_TENANT_SLUG?.trim() || "we-discipline";
if (!email) {
  console.error("Usage: TENANT_SLUG=we-discipline node scripts/with-dev-env.mjs scripts/send-reset-email-now.mjs <email>");
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY?.trim();
const from = process.env.PASSWORD_RESET_FROM?.trim();
const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

console.log("RESEND_API_KEY set:", Boolean(apiKey));
console.log("PASSWORD_RESET_FROM:", from || "(missing)");

if (!apiKey || !from) {
  console.error("Configure RESEND_API_KEY and PASSWORD_RESET_FROM in .env.development");
  process.exit(1);
}

const prisma = new PrismaClient();
const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true, slug: true } });
if (!tenant) {
  console.error(`Tenant not found: ${tenantSlug}`);
  process.exit(1);
}

const user = await prisma.user.findUnique({
  where: { tenantId_email: { tenantId: tenant.id, email } },
  select: { id: true, email: true, name: true, isActive: true },
});

if (!user?.isActive) {
  console.error(user ? "User inactive." : "No user with this email in tenant.");
  process.exit(1);
}

const token = randomBytes(32).toString("hex");
const tokenHash = createHash("sha256").update(token).digest("hex");
const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

await prisma.passwordResetToken.updateMany({
  where: { tenantId: tenant.id, userId: user.id, usedAt: null },
  data: { usedAt: new Date() },
});
await prisma.passwordResetToken.create({
  data: { tenantId: tenant.id, userId: user.id, tokenHash, expiresAt },
});

const resetUrl = `${appUrl}/reset-password?token=${token}`;
const appName = process.env.APP_NAME?.trim() || "GymDay";

const resend = new Resend(apiKey);
const { data, error } = await resend.emails.send({
  from,
  to: user.email,
  subject: `${appName} - Reinitialiser votre mot de passe`,
  html: `<p>Bonjour,</p><p><a href="${resetUrl}">Reinitialiser le mot de passe</a></p><p>Expire dans 60 minutes.</p>`,
  text: `Reinitialiser: ${resetUrl} (60 min)`,
});

if (error) {
  console.error("Resend error:", error);
  process.exit(1);
}

console.log("Sent to:", user.email, `(${user.name})`);
console.log("Tenant:", tenant.slug);
console.log("Resend id:", data?.id);
console.log("Reset URL (backup):", resetUrl);

await prisma.$disconnect();
