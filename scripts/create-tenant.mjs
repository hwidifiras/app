import { PrismaClient } from "@prisma/client";

import { resolveTenantBootstrapConfig } from "./lib/tenant-bootstrap.mjs";

const prisma = new PrismaClient();

const { id, name, rootDomainAlias, slug } = resolveTenantBootstrapConfig();

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

await prisma.tenantModule.upsert({
  where: {
    tenantId_moduleKey: {
      tenantId: tenant.id,
      moduleKey: "CLASS_MANAGEMENT",
    },
  },
  create: {
    tenantId: tenant.id,
    moduleKey: "CLASS_MANAGEMENT",
    status: "ENABLED",
    grantSource: "MANUAL",
    enabledAt: new Date(),
  },
  update: {
    status: "ENABLED",
    grantSource: "MANUAL",
    saasSubscriptionId: null,
    disabledAt: null,
  },
});

await prisma.$disconnect();

console.log(`Tenant ready: ${tenant.slug} (${tenant.id})`);
