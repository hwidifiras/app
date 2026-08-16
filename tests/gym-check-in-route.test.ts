import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => {
  const scope = globalThis as typeof globalThis & {
    __gymdayTestAuthState?: { token: string | null };
  };
  return (scope.__gymdayTestAuthState ??= { token: null });
});

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => authState.token ? { value: authState.token } : undefined }),
}));

import { POST as checkIn } from "@/app/api/gym/check-in/route";
import { signAuthToken } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createSubscriptionFromPlan } from "@/lib/subscription-service";
import { withTenantContext } from "@/lib/tenant-context";
import { requireTenantModule } from "@/lib/tenant-modules";
import { issueGymCredential } from "@/modules/gym/access-credentials";

const TENANT_ID = "tenant_gym_route";
const TENANT_SLUG = "gym-route";

async function withRouteTenant<T>(operation: () => Promise<T>) {
  return withTenantContext(
    { tenantId: TENANT_ID, tenantSlug: TENANT_SLUG, host: `${TENANT_SLUG}.test.local` },
    async () => await operation(),
  );
}

function request(body: unknown) {
  return new Request(`http://${TENANT_SLUG}.localhost/api/gym/check-in`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function fixture() {
  await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    create: { id: TENANT_ID, slug: TENANT_SLUG, name: "Gym Route Test" },
    update: { status: "ACTIVE" },
  });
  return withRouteTenant(async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const actor = await prisma.user.create({
    data: {
      tenantId: TENANT_ID,
      email: `gym-route-${suffix}@example.test`,
      name: "Agent salle",
      passwordHash: "test",
      role: "ADMIN",
    },
  });
  authState.token = await signAuthToken({
    userId: actor.id,
    tenantId: TENANT_ID,
    tenantSlug: TENANT_SLUG,
    email: actor.email,
    name: actor.name,
    role: actor.role,
    permissions: [],
  });
  await prisma.tenantModule.upsert({
    where: { tenantId_moduleKey: { tenantId: TENANT_ID, moduleKey: "GYM_ACCESS" } },
    create: { tenantId: TENANT_ID, moduleKey: "GYM_ACCESS", status: "ENABLED", enabledAt: new Date() },
    update: { status: "ENABLED", enabledAt: new Date(), disabledAt: null },
  });
  await prisma.clubSettings.upsert({
    where: { tenantId: TENANT_ID },
    create: {
      tenantId: TENANT_ID,
      gymAllowCheckInWithPartialPayment: true,
      gymAllowExceptionalAccess: true,
      gymDuplicateScanWindowMinutes: 2,
      gymEnforceOpeningHours: false,
      gymOpeningHours: [],
    },
    update: {
      gymAllowCheckInWithPartialPayment: true,
      gymAllowExceptionalAccess: true,
      gymDuplicateScanWindowMinutes: 2,
      gymDailyVisitLimit: null,
      gymEnforceOpeningHours: false,
      gymOpeningHours: [],
    },
  });
  const member = await prisma.member.create({
    data: { tenantId: TENANT_ID, firstName: "Scan", lastName: "Membre", phone: `scan-${suffix}` },
  });
  const plan = await prisma.subscriptionPlan.create({
    data: {
      tenantId: TENANT_ID,
      name: `Pass scan ${suffix}`,
      planKind: "GYM",
      price: 5000,
      totalSessions: 0,
      validityDays: 30,
      entitlements: {
        create: { tenantId: TENANT_ID, type: "GYM_ACCESS", gymAccessMode: "VISIT_QUOTA", grantedUnits: 3 },
      },
    },
  });
  const subscription = await prisma.$transaction((tx) => createSubscriptionFromPlan(tx, {
    tenantId: TENANT_ID,
    memberId: member.id,
    plan,
    startDate: new Date(),
  }));
  await prisma.payment.create({ data: { tenantId: TENANT_ID, memberSubscriptionId: subscription.id, amount: 5000 } });
  const issued = await prisma.$transaction((tx) => issueGymCredential(tx, {
    tenantId: TENANT_ID,
    memberId: member.id,
    actorId: actor.id,
  }));
  return { actor, member, subscription, issued };
  });
}

describe("gym credential check-in route", () => {
  beforeEach(() => {
    authState.token = null;
  });

  it("records a signed-card admission, duplicate denial, and authorized override", async () => {
    const fx = await fixture();
    await expect(withRouteTenant(() => requirePermission(request({}), "gym.checkin"))).resolves.toMatchObject({
      id: fx.actor.id,
      tenantId: TENANT_ID,
      role: "ADMIN",
    });
    await expect(requireTenantModule(TENANT_ID, "GYM_ACCESS")).resolves.toBeUndefined();
    const admitted = await withRouteTenant(() => checkIn(request({ credentialCode: fx.issued.credentialCode })));
    const admittedPayload = await admitted.clone().json();
    expect(admitted.status, JSON.stringify(admittedPayload)).toBe(201);
    expect(await withRouteTenant(() => prisma.gymVisit.count({
      where: { tenantId: TENANT_ID, memberId: fx.member.id, entryType: "CHECK_IN" },
    }))).toBe(1);

    const duplicate = await withRouteTenant(() => checkIn(request({ credentialCode: fx.issued.credentialCode })));
    expect(duplicate.status).toBe(403);
    expect(await withRouteTenant(() => prisma.gymAccessAttempt.count({
      where: { tenantId: TENANT_ID, memberId: fx.member.id, outcome: "DENIED", failureCode: "DUPLICATE_SCAN" },
    }))).toBe(1);

    const exceptional = await withRouteTenant(() => checkIn(request({
      credentialCode: fx.issued.credentialCode,
      overrideReason: "Double entrée autorisée par le responsable",
    })));
    expect(exceptional.status).toBe(201);
    expect(await withRouteTenant(() => prisma.gymAccessAttempt.count({
      where: { tenantId: TENANT_ID, memberId: fx.member.id, outcome: "EXCEPTIONAL_ALLOWED" },
    }))).toBe(1);
    const entitlement = await withRouteTenant(() => prisma.subscriptionEntitlement.findFirstOrThrow({
      where: { tenantId: TENANT_ID, memberSubscriptionId: fx.subscription.id, type: "GYM_ACCESS" },
    }));
    expect(entitlement.remainingUnits).toBe(1);
  });

  it("stores only a fingerprint for an unknown scanned value", async () => {
    await fixture();
    const rawUnknownCode = `WDG1.${"x".repeat(24)}.${"y".repeat(43)}`;
    const response = await withRouteTenant(() => checkIn(request({ credentialCode: rawUnknownCode })));
    const responsePayload = await response.clone().json();
    expect(response.status, JSON.stringify(responsePayload)).toBe(403);
    const attempt = await withRouteTenant(() => prisma.gymAccessAttempt.findFirstOrThrow({
      where: { tenantId: TENANT_ID, outcome: "DENIED", failureCode: "CREDENTIAL_INVALID" },
      orderBy: { occurredAt: "desc" },
    }));
    expect(attempt.identifierFingerprint).toMatch(/^[a-f0-9]{32}$/);
    expect(attempt.identifierFingerprint).not.toContain(rawUnknownCode);
    expect(attempt.memberId).toBeNull();
  });
});
