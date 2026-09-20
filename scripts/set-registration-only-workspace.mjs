import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const [tenantSlug, requestedMode = "status"] = process.argv.slice(2);
const validModes = new Set(["enable", "disable", "status"]);

if (!tenantSlug || !validModes.has(requestedMode)) {
  console.error("Usage: node scripts/set-registration-only-workspace.mjs <tenant-slug> <enable|disable|status>");
  process.exitCode = 1;
} else {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, slug: true, name: true },
    });
    if (!tenant) throw new Error(`Tenant introuvable: ${tenantSlug}`);

    if (requestedMode !== "status") {
      await prisma.clubSettings.upsert({
        where: { tenantId: tenant.id },
        update: { registrationOnly: requestedMode === "enable" },
        create: {
          tenantId: tenant.id,
          clubName: tenant.name,
          registrationOnly: requestedMode === "enable",
        },
      });
    }

    const settings = await prisma.clubSettings.findUnique({
      where: { tenantId: tenant.id },
      select: { registrationOnly: true },
    });
    console.log(JSON.stringify({
      tenant: tenant.slug,
      registrationOnly: settings?.registrationOnly ?? false,
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
