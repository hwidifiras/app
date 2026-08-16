import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { getTenantProductContext } from "@/platform/product/product-context";
import { TEST_TENANT_ID, TEST_TENANT_SLUG } from "./setup";

const PLAN_CODE = "TEST_SAAS_CLASS";

async function ensurePlan() {
  return prisma.saasPlan.upsert({
    where: { code: PLAN_CODE },
    create: {
      code: PLAN_CODE,
      name: "Plan SaaS test",
      priceCents: null,
      modules: { create: { moduleKey: "CLASS_MANAGEMENT" } },
    },
    update: {},
  });
}

async function resetCurrentSubscription() {
  await prisma.tenantModule.updateMany({
    where: { tenantId: TEST_TENANT_ID },
    data: { grantSource: "MANUAL", saasSubscriptionId: null },
  });
  await prisma.tenantSaasSubscription.deleteMany({ where: { tenantId: TEST_TENANT_ID } });
}

describe("manual SaaS subscription persistence", () => {
  beforeEach(async () => {
    await ensurePlan();
    await resetCurrentSubscription();
  });

  it("exposes current commercial status through the request product context", async () => {
    const plan = await ensurePlan();
    const current = await prisma.tenantSaasSubscription.create({
      data: {
        tenantId: TEST_TENANT_ID,
        saasPlanId: plan.id,
        status: "PAST_DUE",
        currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
      },
    });
    await prisma.tenantModule.updateMany({
      where: { tenantId: TEST_TENANT_ID, moduleKey: "CLASS_MANAGEMENT" },
      data: {
        grantSource: "SAAS_SUBSCRIPTION",
        saasSubscriptionId: current.id,
      },
    });

    const product = await getTenantProductContext(TEST_TENANT_ID);
    expect(product).toMatchObject({
      saasStatus: "PAST_DUE",
      operationsAllowed: true,
      billingWarning: "PAST_DUE",
      saasSubscription: { id: current.id, planCode: PLAN_CODE },
    });
  });

  it("enforces one current SaaS subscription per tenant", async () => {
    const plan = await ensurePlan();
    await prisma.tenantSaasSubscription.create({
      data: { tenantId: TEST_TENANT_ID, saasPlanId: plan.id, status: "ACTIVE" },
    });

    await expect(
      prisma.tenantSaasSubscription.create({
        data: { tenantId: TEST_TENANT_ID, saasPlanId: plan.id, status: "TRIAL" },
      }),
    ).rejects.toThrow();
  });

  it("enforces an expired automatic trial through the tenant product context", async () => {
    const plan = await ensurePlan();
    await prisma.tenantSaasSubscription.create({
      data: {
        tenantId: TEST_TENANT_ID,
        saasPlanId: plan.id,
        status: "TRIAL",
        automaticLifecycle: true,
        startsAt: new Date("2020-01-01T00:00:00.000Z"),
        trialEndsAt: new Date("2020-01-14T00:00:00.000Z"),
        currentPeriodEnd: new Date("2020-01-14T00:00:00.000Z"),
        graceEndsAt: new Date("2020-01-17T00:00:00.000Z"),
      },
    });

    const product = await getTenantProductContext(TEST_TENANT_ID);
    expect(product).toMatchObject({
      saasStatus: "SUSPENDED",
      operationsAllowed: false,
      billingWarning: null,
      subscriptionBlockReason: "TRIAL_EXPIRED",
      subscriptionDaysRemaining: 0,
    });
  });

  it("rejects a module grant linked to another tenant's subscription", async () => {
    const plan = await ensurePlan();
    const foreignTenant = await prisma.tenant.upsert({
      where: { slug: "saas-control-foreign" },
      create: { slug: "saas-control-foreign", name: "Foreign SaaS tenant" },
      update: { status: "ACTIVE" },
    });
    const foreignSubscriptionId = "saas_control_foreign_subscription";
    await prisma.$executeRaw`
      INSERT INTO "TenantSaasSubscription" (
        "id", "tenantId", "saasPlanId", "status", "isCurrent", "startsAt", "createdAt", "updatedAt"
      ) VALUES (
        ${foreignSubscriptionId}, ${foreignTenant.id}, ${plan.id}, 'ACTIVE'::"SaasSubscriptionStatus",
        true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;

    await expect(
      prisma.$executeRaw`
        UPDATE "TenantModule"
        SET
          "grantSource" = 'SAAS_SUBSCRIPTION'::"TenantModuleGrantSource",
          "saasSubscriptionId" = ${foreignSubscriptionId}
        WHERE "tenantId" = ${TEST_TENANT_ID}
          AND "moduleKey" = 'CLASS_MANAGEMENT'::"TenantModuleKey"
      `,
    ).rejects.toThrow(/TENANT_REFERENCE_MISMATCH|constraint/i);
  });

  it("keeps platform audit records append-only", async () => {
    const log = await prisma.platformAuditLog.create({
      data: {
        tenantId: TEST_TENANT_ID,
        action: "SAAS_TEST_ACTION",
        entityType: "Tenant",
        entityId: TEST_TENANT_ID,
        operatorIdentity: "test-operator",
        beforeState: { status: "TRIAL" },
        afterState: { status: "ACTIVE" },
      },
    });

    await expect(
      prisma.platformAuditLog.update({
        where: { id: log.id },
        data: { action: "MUTATED" },
      }),
    ).rejects.toThrow(/PLATFORM_AUDIT_APPEND_ONLY|constraint/i);
  });

  it("keeps a tenant without a subscription in legacy-active mode", async () => {
    const product = await getTenantProductContext(TEST_TENANT_ID);
    expect(product.saasStatus).toBe("LEGACY_ACTIVE");
    expect(product.operationsAllowed).toBe(true);
    expect(TEST_TENANT_SLUG).toBe("we-discipline");
  });
});
