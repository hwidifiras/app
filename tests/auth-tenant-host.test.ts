import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({ token: null as string | null }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (authState.token ? { value: authState.token } : undefined),
  }),
  headers: async () => new Headers({ host: "test.local" }),
}));

import { GET as getAccount } from "@/app/api/account/route";
import { GET as getAuthMe } from "@/app/api/auth/me/route";
import { signAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PRIMARY_TENANT_ID = "tenant_test";
const PRIMARY_TENANT_SLUG = "we-discipline";
const OTHER_TENANT_ID = "tenant_other_auth";
const OTHER_TENANT_SLUG = "other-auth-tenant";
const OTHER_TENANT_HOST = "other-auth.test.local";

describe("auth tenant host binding", () => {
  beforeEach(() => {
    authState.token = null;
  });

  it("accepts the token on its tenant host and rejects it on another tenant host", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        tenantId: PRIMARY_TENANT_ID,
        name: "Host-bound admin",
        email: `host-bound-${suffix}@test.local`,
        role: "ADMIN",
        isActive: true,
        passwordHash: "test",
      },
    });
    await prisma.tenant.upsert({
      where: { slug: OTHER_TENANT_SLUG },
      create: {
        id: OTHER_TENANT_ID,
        slug: OTHER_TENANT_SLUG,
        name: "Other auth tenant",
        rootDomainAlias: OTHER_TENANT_HOST,
      },
      update: {
        status: "ACTIVE",
        rootDomainAlias: OTHER_TENANT_HOST,
      },
    });

    authState.token = await signAuthToken({
      userId: user.id,
      tenantId: PRIMARY_TENANT_ID,
      tenantSlug: PRIMARY_TENANT_SLUG,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: [],
    });

    const sameTenant = await getAccount(new Request("http://test.local/api/account"));
    expect(sameTenant.status).toBe(200);

    const crossTenant = await getAccount(
      new Request(`http://${OTHER_TENANT_HOST}/api/account`),
    );
    expect(crossTenant.status).toBe(401);

    const crossTenantMe = await getAuthMe(
      new Request(`http://${OTHER_TENANT_HOST}/api/auth/me`),
    );
    expect((await crossTenantMe.json()).data).toBeNull();
  });
});
