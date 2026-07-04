import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { setFallbackTenantContext } from "@/lib/tenant-context";

const TEST_TENANT_ID = "tenant_test";
const TEST_TENANT_SLUG = "we-discipline";
const OTHER_TENANT_ID = "tenant_other";
const OTHER_TENANT_SLUG = "other-club";

async function useTenant(tenantId: string, tenantSlug: string) {
  await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    create: { id: tenantId, slug: tenantSlug, name: tenantSlug },
    update: { status: "ACTIVE" },
  });
  setFallbackTenantContext({ tenantId, tenantSlug, host: `${tenantSlug}.test.local` });
}

describe("tenant isolation", () => {
  beforeEach(async () => {
    await useTenant(TEST_TENANT_ID, TEST_TENANT_SLUG);
  });

  it("allows the same user email in different tenants but not the same tenant", async () => {
    const email = `same-${Date.now()}@test.local`;

    await prisma.user.create({
      data: {
        email,
        name: "Tenant A",
        role: "ADMIN",
        passwordHash: "hash",
      },
    });

    await expect(
      prisma.user.create({
        data: {
          email,
          name: "Tenant A Duplicate",
          role: "STAFF",
          passwordHash: "hash",
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });

    await useTenant(OTHER_TENANT_ID, OTHER_TENANT_SLUG);
    await expect(
      prisma.user.create({
        data: {
          email,
          name: "Tenant B",
          role: "ADMIN",
          passwordHash: "hash",
        },
      }),
    ).resolves.toMatchObject({ email, tenantId: OTHER_TENANT_ID });
  });

  it("allows the same member phone, sport name, and plan name in different tenants", async () => {
    const suffix = `${Date.now()}`;
    const phone = `phone-${suffix}`;
    const sportName = `Sport ${suffix}`;
    const planName = `Plan ${suffix}`;

    const sportA = await prisma.sport.create({ data: { name: sportName } });
    await prisma.subscriptionPlan.create({
      data: {
        name: planName,
        price: 1000,
        totalSessions: 4,
        validityDays: 30,
        sportId: sportA.id,
      },
    });
    await prisma.member.create({ data: { firstName: "A", lastName: "One", phone } });

    await useTenant(OTHER_TENANT_ID, OTHER_TENANT_SLUG);
    const sportB = await prisma.sport.create({ data: { name: sportName } });
    const planB = await prisma.subscriptionPlan.create({
      data: {
        name: planName,
        price: 1000,
        totalSessions: 4,
        validityDays: 30,
        sportId: sportB.id,
      },
    });
    const memberB = await prisma.member.create({ data: { firstName: "B", lastName: "Two", phone } });

    expect(sportB.name).toBe(sportName);
    expect(planB.name).toBe(planName);
    expect(memberB.phone).toBe(phone);
  });

  it("blocks cross-tenant id guessing for reads and updates", async () => {
    const member = await prisma.member.create({
      data: { firstName: "Hidden", lastName: "Member", phone: `hidden-${Date.now()}` },
    });

    await useTenant(OTHER_TENANT_ID, OTHER_TENANT_SLUG);

    await expect(prisma.member.findUnique({ where: { id: member.id } })).resolves.toBeNull();
    await expect(
      prisma.member.update({
        where: { id: member.id },
        data: { firstName: "Leaked" },
      }),
    ).rejects.toMatchObject({ code: "P2025" });
  });
});
