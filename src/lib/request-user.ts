import { cookies, headers } from "next/headers";

import { AUTH_COOKIE_NAME, verifyAuthToken, type AuthRole } from "@/lib/auth";
import { parsePermissions } from "@/lib/permission-definitions";
import { prisma } from "@/lib/prisma";
import { enterTenantContext } from "@/lib/tenant-context";
import { resolveTenantFromHost, resolveTenantFromRequest } from "@/lib/tenant-resolver";
import { requireProductModule } from "@/lib/tenant-modules";
import { isSaasRecoveryPath } from "@/platform/billing/saas-access";
import { getTenantProductContext } from "@/platform/product/product-context";
import { requiredProductModuleForPath } from "@/platform/product/product-registry";

export type RequestUser = {
  id: string;
  tenantId: string;
  tenantSlug: string;
  role: AuthRole;
  email: string;
  name: string;
  permissions: string[];
  coachId: string | null;
};

export async function getAuthUser(request?: Request): Promise<RequestUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyAuthToken(token);
  if (!payload) return null;

  if (!payload.tenantId || !payload.tenantSlug) return null;

  const resolvedTenant = request
    ? await resolveTenantFromRequest(request)
    : await (async () => {
        const requestHeaders = await headers();
        return resolveTenantFromHost(
          requestHeaders.get("host") ?? requestHeaders.get("x-forwarded-host"),
        );
      })();

  if (
    !resolvedTenant.ok
    || resolvedTenant.context.tenantId !== payload.tenantId
    || resolvedTenant.context.tenantSlug !== payload.tenantSlug
  ) {
    return null;
  }

  enterTenantContext(resolvedTenant.context);

  const user = await prisma.user.findFirst({
    where: { id: payload.userId, tenantId: resolvedTenant.context.tenantId },
    select: {
      id: true,
      tenantId: true,
      role: true,
      email: true,
      name: true,
      coachId: true,
      isActive: true,
      tenant: { select: { slug: true, status: true } },
      permissions: { select: { key: true } },
    },
  });

  if (!user || !user.isActive || user.tenant?.status !== "ACTIVE") return null;

  return {
    id: user.id,
    tenantId: resolvedTenant.context.tenantId,
    tenantSlug: resolvedTenant.context.tenantSlug,
    role: user.role,
    email: user.email,
    name: user.name,
    permissions: user.role === "ADMIN" ? [] : parsePermissions(user.permissions.map((permission) => permission.key)),
    coachId: user.coachId,
  };
}

export async function requireAuth(request: Request): Promise<RequestUser> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }

  const pathname = new URL(request.url).pathname;
  const product = await getTenantProductContext(user.tenantId);
  if (!product.operationsAllowed && !isSaasRecoveryPath(pathname)) {
    throw new Error("SAAS_SUBSCRIPTION_BLOCKED");
  }

  const requiredModule = requiredProductModuleForPath(pathname);
  if (requiredModule) {
    await requireProductModule(user.tenantId, requiredModule);
  }

  return user;
}

export async function requireAdmin(request: Request): Promise<RequestUser> {
  const user = await requireAuth(request);
  if (user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return user;
}
