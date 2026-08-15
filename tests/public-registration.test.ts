import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as register } from "@/app/api/auth/register/route";
import { prisma } from "@/lib/prisma";
import { resetRateLimitsForTests } from "@/lib/rate-limit";
import { setFallbackTenantContext } from "@/lib/tenant-context";

const REGISTRATION_TENANT_ID = "tenant_registration_test";
const REGISTRATION_TENANT_SLUG = "registration-test";
const REGISTRATION_HOST = "register.test.local";
const DEFAULT_TEST_TENANT_ID = "tenant_test";
const DEFAULT_TEST_TENANT_SLUG = "we-discipline";

function registrationRequest(body: unknown) {
  return new Request(`http://${REGISTRATION_HOST}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("public registration", () => {
  beforeEach(async () => {
    vi.stubEnv("ALLOW_PUBLIC_REGISTER", "true");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_URL", "");
    vi.stubEnv("RATE_LIMIT_REDIS_REST_TOKEN", "");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    resetRateLimitsForTests();

    await prisma.tenant.upsert({
      where: { slug: REGISTRATION_TENANT_SLUG },
      create: {
        id: REGISTRATION_TENANT_ID,
        slug: REGISTRATION_TENANT_SLUG,
        name: "Registration Test",
        rootDomainAlias: REGISTRATION_HOST,
      },
      update: { status: "ACTIVE", rootDomainAlias: REGISTRATION_HOST },
    });
    setFallbackTenantContext({
      tenantId: REGISTRATION_TENANT_ID,
      tenantSlug: REGISTRATION_TENANT_SLUG,
      host: REGISTRATION_HOST,
    });
    await prisma.clubSettings.upsert({
      where: { tenantId: REGISTRATION_TENANT_ID },
      create: { tenantId: REGISTRATION_TENANT_ID, allowPublicRegister: false },
      update: { allowPublicRegister: false },
    });
    await prisma.auditLog.deleteMany({ where: { action: "USER_REGISTERED" } });
    await prisma.user.deleteMany();
  });

  afterEach(() => {
    resetRateLimitsForTests();
    vi.unstubAllEnvs();
    setFallbackTenantContext({
      tenantId: DEFAULT_TEST_TENANT_ID,
      tenantSlug: DEFAULT_TEST_TENANT_SLUG,
      host: "test.local",
    });
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({ where: { id: REGISTRATION_TENANT_ID } });
  });

  it("rejects registration when the tenant has not enabled it", async () => {
    const response = await register(
      registrationRequest({ name: "Pending User", email: "pending@test.local", password: "password123" }),
    );

    expect(response.status).toBe(403);
    expect(await prisma.user.count()).toBe(0);
  });

  it("creates an inactive zero-permission staff request pending admin approval", async () => {
    await prisma.clubSettings.update({
      where: { tenantId: REGISTRATION_TENANT_ID },
      data: { allowPublicRegister: true },
    });

    const response = await register(
      registrationRequest({ name: "Pending User", email: "pending@test.local", password: "password123" }),
    );
    const body = (await response.json()) as {
      data: {
        id: string;
        role: string;
        isActive: boolean;
        permissions: string[];
        approvalStatus: string;
      };
    };
    const user = await prisma.user.findFirstOrThrow({
      where: { id: body.data.id },
      include: { permissions: true },
    });

    expect(response.status).toBe(201);
    expect(body.data).toMatchObject({
      role: "STAFF",
      isActive: false,
      permissions: [],
      approvalStatus: "PENDING",
    });
    expect(user.isActive).toBe(false);
    expect(user.permissions).toEqual([]);
    await expect(
      prisma.auditLog.count({ where: { action: "USER_REGISTERED", entityId: user.id } }),
    ).resolves.toBe(1);
  });

  it("creates one pending user and one audit entry under a concurrent duplicate request", async () => {
    await prisma.clubSettings.update({
      where: { tenantId: REGISTRATION_TENANT_ID },
      data: { allowPublicRegister: true },
    });

    const payload = { name: "Concurrent User", email: "concurrent@test.local", password: "password123" };
    const responses = await Promise.all([register(registrationRequest(payload)), register(registrationRequest(payload))]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const users = await prisma.user.findMany({ where: { email: payload.email } });
    expect(users).toHaveLength(1);
    await expect(
      prisma.auditLog.count({ where: { action: "USER_REGISTERED", entityId: users[0].id } }),
    ).resolves.toBe(1);
  });

  it("throttles repeated registration attempts per tenant and client", async () => {
    await prisma.clubSettings.update({
      where: { tenantId: REGISTRATION_TENANT_ID },
      data: { allowPublicRegister: true },
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await register(registrationRequest({ name: "x" }));
      expect(response.status).toBe(400);
    }

    const blocked = await register(registrationRequest({ name: "x" }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
  });
});
