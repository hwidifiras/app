import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const name = process.env.ADMIN_NAME?.trim() || "Admin";
const password = process.env.ADMIN_PASSWORD?.trim();
const tenantSlug = process.env.TENANT_SLUG?.trim() || process.env.DEFAULT_TENANT_SLUG?.trim() || "we-discipline";
const tenantId =
  process.env.TENANT_ID?.trim() ||
  process.env.DEFAULT_TENANT_ID?.trim() ||
  `tenant_${tenantSlug.replace(/[^a-z0-9_-]/gi, "_")}`;
const tenantName = process.env.TENANT_NAME?.trim() || process.env.DEFAULT_TENANT_NAME?.trim() || "We Discipline";
const rootDomainAlias =
  process.env.TENANT_ROOT_DOMAIN_ALIAS?.trim() ||
  process.env.DEFAULT_TENANT_ROOT_ALIAS?.trim() ||
  null;

if (!email || !password) {
  console.error("ADMIN_EMAIL and ADMIN_PASSWORD are required.");
  process.exit(1);
}

if (password.length < 8) {
  console.error("ADMIN_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const tenant = await prisma.tenant.upsert({
  where: { slug: tenantSlug },
  create: {
    id: tenantId,
    slug: tenantSlug,
    name: tenantName,
    rootDomainAlias,
    status: "ACTIVE",
  },
  update: {
    name: tenantName,
    rootDomainAlias,
    status: "ACTIVE",
  },
});

await prisma.clubSettings.upsert({
  where: { tenantId: tenant.id },
  create: { tenantId: tenant.id, clubName: tenant.name },
  update: {},
});

const passwordHash = await bcrypt.hash(password, 10);

const user = await prisma.user.upsert({
  where: { tenantId_email: { tenantId: tenant.id, email } },
  update: {
    name,
    role: "ADMIN",
    isActive: true,
    passwordHash,
  },
  create: {
    tenantId: tenant.id,
    email,
    name,
    role: "ADMIN",
    isActive: true,
    passwordHash,
  },
  select: { id: true, email: true, name: true, role: true },
});

await prisma.auditLog.create({
  data: {
    tenantId: tenant.id,
    action: "ADMIN_BOOTSTRAPPED",
    entityType: "User",
    entityId: user.id,
    details: JSON.stringify({ email: user.email, tenantSlug: tenant.slug }),
  },
});

await prisma.$disconnect();

console.log(`Admin ready: ${user.email} for tenant ${tenant.slug}`);
