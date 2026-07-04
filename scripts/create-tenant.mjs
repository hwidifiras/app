import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const slug = process.env.TENANT_SLUG?.trim() || process.env.DEFAULT_TENANT_SLUG?.trim();
const name = process.env.TENANT_NAME?.trim() || process.env.DEFAULT_TENANT_NAME?.trim() || slug;
const id = process.env.TENANT_ID?.trim() || (slug ? `tenant_${slug.replace(/[^a-z0-9_-]/gi, "_")}` : "");
const rootDomainAlias =
  process.env.TENANT_ROOT_DOMAIN_ALIAS?.trim() ||
  process.env.DEFAULT_TENANT_ROOT_ALIAS?.trim() ||
  null;

if (!slug || !name || !id) {
  console.error("TENANT_SLUG and TENANT_NAME are required.");
  process.exit(1);
}

const tenant = await prisma.tenant.upsert({
  where: { slug },
  create: {
    id,
    slug,
    name,
    rootDomainAlias,
    status: "ACTIVE",
  },
  update: {
    name,
    rootDomainAlias,
    status: "ACTIVE",
  },
});

await prisma.clubSettings.upsert({
  where: { tenantId: tenant.id },
  create: { tenantId: tenant.id, clubName: tenant.name },
  update: {},
});

await prisma.$disconnect();

console.log(`Tenant ready: ${tenant.slug} (${tenant.id})`);
