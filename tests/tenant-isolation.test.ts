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
    await expect(
      prisma.member.updateMany({
        where: { id: member.id },
        data: { firstName: "Leaked in bulk" },
      }),
    ).resolves.toEqual({ count: 0 });
  });

  it("rejects cross-tenant foreign keys at the database boundary", async () => {
    const suffix = `${Date.now()}`;
    const member = await prisma.member.create({
      data: { firstName: "Ledger", lastName: "Owner", phone: `ledger-${suffix}` },
    });
    const sport = await prisma.sport.create({ data: { name: `Ledger sport ${suffix}` } });
    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: `Ledger plan ${suffix}`,
        price: 5_000,
        totalSessions: 4,
        validityDays: 30,
        sportId: sport.id,
      },
    });
    const subscription = await prisma.memberSubscription.create({
      data: {
        memberId: member.id,
        planId: plan.id,
        sportId: sport.id,
        startDate: new Date(),
        amount: plan.price,
        remainingSessions: plan.totalSessions,
        status: "ACTIVE",
      },
    });

    await useTenant(OTHER_TENANT_ID, OTHER_TENANT_SLUG);

    await expect(
      prisma.member.update({ where: { id: member.id }, data: { tenantId: OTHER_TENANT_ID } }),
    ).rejects.toMatchObject({ code: "P2025" });

    await expect(
      prisma.payment.create({ data: { memberSubscriptionId: subscription.id, amount: 100 } }),
    ).rejects.toThrow(/TENANT_REFERENCE_MISMATCH/);
  });

  it("keeps an idempotency record bound to its original tenant at the database boundary", async () => {
    const suffix = `${Date.now()}`;
    const record = await prisma.idempotencyRecord.create({
      data: {
        tenantId: TEST_TENANT_ID,
        scope: "tenant-guard-test",
        key: `key-${suffix}`,
        requestHash: `hash-${suffix}`,
        responseStatus: 201,
        responseBody: '{"data":true}',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await useTenant(OTHER_TENANT_ID, OTHER_TENANT_SLUG);

    await expect(
      prisma.idempotencyRecord.update({ where: { id: record.id }, data: { tenantId: OTHER_TENANT_ID } }),
    ).rejects.toMatchObject({ code: "P2025" });
  });

  it("only links a coach account inside the same tenant", async () => {
    const suffix = `${Date.now()}`;
    const coach = await prisma.coach.create({
      data: {
        firstName: "Coach",
        lastName: "Tenant A",
        phone: `coach-${suffix}`,
      },
    });

    await useTenant(OTHER_TENANT_ID, OTHER_TENANT_SLUG);
    await expect(
      prisma.user.create({
        data: {
          email: `cross-coach-${suffix}@test.local`,
          name: "Cross tenant coach",
          role: "STAFF",
          passwordHash: "hash",
          coachId: coach.id,
        },
      }),
    ).rejects.toThrow(/TENANT_REFERENCE_MISMATCH/);

    await useTenant(TEST_TENANT_ID, TEST_TENANT_SLUG);
    await expect(
      prisma.user.create({
        data: {
          email: `coach-${suffix}@test.local`,
          name: "Coach account",
          role: "STAFF",
          passwordHash: "hash",
          coachId: coach.id,
        },
      }),
    ).resolves.toMatchObject({ tenantId: TEST_TENANT_ID, coachId: coach.id });
  });
});
