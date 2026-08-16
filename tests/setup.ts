import { beforeEach } from "vitest";

Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_URL: process.env.TEST_DATABASE_URL || "postgresql://gymday:gymday@localhost:5432/gymday_test?schema=public",
  AUTH_SECRET: "test-auth-secret-32-characters-minimum-value",
  ACCESS_CREDENTIAL_SECRET: "test-access-card-secret-32-characters-minimum",
  APP_TIMEZONE: "Africa/Tunis",
  SAAS_ROOT_DOMAIN: "localhost",
  DEFAULT_TENANT_SLUG: "we-discipline",
  RESEND_API_KEY: "",
  PASSWORD_RESET_FROM: "",
});

export const TEST_TENANT_ID = "tenant_test";
export const TEST_TENANT_SLUG = "we-discipline";
const skipTestDbSetup = process.env.SKIP_TEST_DB_SETUP === "1";

const { setFallbackTenantContext } = await import("@/lib/tenant-context");

setFallbackTenantContext({ tenantId: TEST_TENANT_ID, tenantSlug: TEST_TENANT_SLUG, host: "test.local" });

if (skipTestDbSetup) {
  beforeEach(() => {
    setFallbackTenantContext({ tenantId: TEST_TENANT_ID, tenantSlug: TEST_TENANT_SLUG, host: "test.local" });
  });
} else {
  const { prisma } = await import("@/lib/prisma");

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
      update: { status: "ACTIVE", rootDomainAlias: "test.local" },
    });

    await prisma.tenantModule.upsert({
      where: {
        tenantId_moduleKey: {
          tenantId: TEST_TENANT_ID,
          moduleKey: "CLASS_MANAGEMENT",
        },
      },
      create: {
        id: "tenant_test_module_class",
        tenantId: TEST_TENANT_ID,
        moduleKey: "CLASS_MANAGEMENT",
        status: "ENABLED",
        enabledAt: new Date(),
      },
      update: {
        status: "ENABLED",
        enabledAt: new Date(),
        disabledAt: null,
      },
    });

    await prisma.clubSettings.upsert({
      where: { tenantId: TEST_TENANT_ID },
      create: { tenantId: TEST_TENANT_ID },
      update: {},
    });
  });
}
