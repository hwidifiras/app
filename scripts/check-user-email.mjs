import { PrismaClient } from "@prisma/client";

const email = (process.argv[2] ?? "").trim().toLowerCase();
const tenantSlug = process.env.TENANT_SLUG?.trim() || process.env.DEFAULT_TENANT_SLUG?.trim() || "we-discipline";

if (!email) {
  console.error("Usage: TENANT_SLUG=we-discipline node scripts/check-user-email.mjs <email>");
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
  select: { id: true, tenantId: true, email: true, name: true, role: true, isActive: true },
});

console.log(JSON.stringify({ tenant, user }, null, 2));
await prisma.$disconnect();
