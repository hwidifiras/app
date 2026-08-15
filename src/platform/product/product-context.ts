import type { TenantModuleKey } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  getRequiredTenantId,
  memoizeTenantRequest,
} from "@/lib/tenant-context";
import {
  resolveSaasOperationalAccess,
  type EffectiveSaasStatus,
  type SaasOperationalAccess,
} from "@/platform/billing/saas-access";

export const PRODUCT_MODULES = ["CLASS_MANAGEMENT", "GYM_ACCESS"] as const satisfies readonly TenantModuleKey[];

export type ProductModule = (typeof PRODUCT_MODULES)[number];
export type ProductProfile = "CLASS_ONLY" | "GYM_ONLY" | "HYBRID";
export type TenantSaasStatus = EffectiveSaasStatus;

export type ProductCapabilities = {
  classManagement: boolean;
  gymAccess: boolean;
  classSales: boolean;
  gymSales: boolean;
  mixedSales: boolean;
  classReports: boolean;
  gymReports: boolean;
};

export type TenantProductContext = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  saasStatus: TenantSaasStatus;
  operationsAllowed: boolean;
  billingWarning: SaasOperationalAccess["warning"];
  saasSubscription: SaasOperationalAccess["subscription"];
  modules: ProductModule[];
  profile: ProductProfile;
  capabilities: ProductCapabilities;
};

export function deriveProductProfile(modules: Iterable<ProductModule>): ProductProfile {
  const enabled = new Set(modules);
  const hasClasses = enabled.has("CLASS_MANAGEMENT");
  const hasGym = enabled.has("GYM_ACCESS");

  if (hasClasses && hasGym) return "HYBRID";
  if (hasGym) return "GYM_ONLY";
  if (hasClasses) return "CLASS_ONLY";

  throw new Error("TENANT_PRODUCT_UNCONFIGURED");
}

export function buildProductCapabilities(modules: Iterable<ProductModule>): ProductCapabilities {
  const enabled = new Set(modules);
  const classManagement = enabled.has("CLASS_MANAGEMENT");
  const gymAccess = enabled.has("GYM_ACCESS");

  return {
    classManagement,
    gymAccess,
    classSales: classManagement,
    gymSales: gymAccess,
    mixedSales: classManagement && gymAccess,
    classReports: classManagement,
    gymReports: gymAccess,
  };
}

export function getTenantProductContext(tenantId = getRequiredTenantId()): Promise<TenantProductContext> {
  return memoizeTenantRequest(`tenant-product:${tenantId}`, async () => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        modules: {
          where: { status: "ENABLED" },
          select: { moduleKey: true },
          orderBy: { moduleKey: "asc" },
        },
        saasSubscriptions: {
          where: { isCurrent: true },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            startsAt: true,
            trialEndsAt: true,
            currentPeriodEnd: true,
            graceEndsAt: true,
            saasPlan: {
              select: {
                code: true,
                name: true,
                userLimit: true,
                memberLimit: true,
              },
            },
          },
        },
      },
    });

    if (!tenant) throw new Error("TENANT_NOT_FOUND");

    const modules = tenant.modules.map((entry) => entry.moduleKey) as ProductModule[];
    const currentSubscription = tenant.saasSubscriptions[0];
    const access = resolveSaasOperationalAccess({
      tenantStatus: tenant.status,
      subscription: currentSubscription
        ? {
            ...currentSubscription,
            plan: currentSubscription.saasPlan,
          }
        : null,
    });
    return {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      saasStatus: access.status,
      operationsAllowed: access.canOperate,
      billingWarning: access.warning,
      saasSubscription: access.subscription,
      modules,
      profile: deriveProductProfile(modules),
      capabilities: buildProductCapabilities(modules),
    };
  });
}

export function productHasModule(context: TenantProductContext, module: ProductModule): boolean {
  return context.modules.includes(module);
}
