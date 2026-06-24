import { beforeEach } from "vitest";

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgresql://gymday:gymday@localhost:5432/gymday_test?schema=public";
process.env.AUTH_SECRET = "test-secret";
process.env.APP_TIMEZONE = "Africa/Tunis";
process.env.SAAS_ROOT_DOMAIN = "localhost";
process.env.DEFAULT_TENANT_SLUG = "we-discipline";
process.env.RESEND_API_KEY = "";
process.env.PASSWORD_RESET_FROM = "";

export const TEST_TENANT_ID = "tenant_test";
export const TEST_TENANT_SLUG = "we-discipline";

const { setFallbackTenantContext } = await import("@/lib/tenant-context");
const { prisma } = await import("@/lib/prisma");

setFallbackTenantContext({ tenantId: TEST_TENANT_ID, tenantSlug: TEST_TENANT_SLUG, host: "test.local" });

beforeEach(async () => {
  setFallbackTenantContext({ tenantId: TEST_TENANT_ID, tenantSlug: TEST_TENANT_SLUG, host: "test.local" });

  await prisma.tenant.upsert({
    where: { slug: TEST_TENANT_SLUG },
    create: {
      id: TEST_TENANT_ID,
      slug: TEST_TENANT_SLUG,
      name: "Test Tenant",
      rootDomainAlias: "test.local",
    },
    update: { status: "ACTIVE" },
  });

  await prisma.clubSettings.upsert({
    where: { tenantId: TEST_TENANT_ID },
    create: { tenantId: TEST_TENANT_ID },
    update: {},
  });
});
