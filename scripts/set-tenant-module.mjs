import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const [tenantSlug, action = "status"] = process.argv.slice(2);

if (!tenantSlug || !["enable", "disable", "status"].includes(action)) {
  console.error("Usage: node scripts/set-tenant-module.mjs <tenant-slug> <enable|disable|status>");
  process.exitCode = 1;
} else {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new Error(`Tenant introuvable: ${tenantSlug}`);

    if (action === "enable") {
      const now = new Date();
      await prisma.tenantModule.upsert({
        where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: "GYM" } },
        update: { status: "ENABLED", enabledAt: now, disabledAt: null },
        create: { tenantId: tenant.id, moduleKey: "GYM", status: "ENABLED", enabledAt: now },
      });
    } else if (action === "disable") {
      const now = new Date();
      await prisma.tenantModule.upsert({
        where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: "GYM" } },
        update: { status: "DISABLED", disabledAt: now },
        create: { tenantId: tenant.id, moduleKey: "GYM", status: "DISABLED", disabledAt: now },
      });
    }

    const tenantModule = await prisma.tenantModule.findUnique({
      where: { tenantId_moduleKey: { tenantId: tenant.id, moduleKey: "GYM" } },
    });
    console.log(JSON.stringify({ tenant: tenant.slug, module: "GYM", status: tenantModule?.status ?? "DISABLED" }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
