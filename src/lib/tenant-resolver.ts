import { prisma } from "@/lib/prisma";
import { normalizeHost, tenantSlugFromHost } from "@/lib/tenant-host";
import type { TenantContext } from "@/lib/tenant-context";

export type ResolvedTenant =
  | { ok: true; context: TenantContext }
  | { ok: false; reason: "missing-host" | "unknown-tenant" | "suspended-tenant"; host: string };

function hostFromRequest(request: Request): string {
  return (
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    new URL(request.url).host
  );
}

export async function resolveTenantFromHost(hostValue: string | null | undefined): Promise<ResolvedTenant> {
  const host = normalizeHost(hostValue);
  if (!host) return { ok: false, reason: "missing-host", host: "" };

  const slug = tenantSlugFromHost(host);
  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        ...(slug ? [{ slug }] : []),
        { rootDomainAlias: host },
      ],
    },
    select: {
      id: true,
      slug: true,
      status: true,
    },
  });

  if (!tenant) return { ok: false, reason: "unknown-tenant", host };
  if (tenant.status !== "ACTIVE") return { ok: false, reason: "suspended-tenant", host };

  return {
    ok: true,
    context: {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      host,
    },
  };
}

export async function resolveTenantFromRequest(request: Request): Promise<ResolvedTenant> {
  return resolveTenantFromHost(hostFromRequest(request));
}
