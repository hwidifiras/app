import type { TenantModuleKey } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  getTenantProductContext,
  productHasModule,
  type ProductModule,
} from "@/platform/product/product-context";

export async function isTenantModuleEnabled(tenantId: string, moduleKey: TenantModuleKey): Promise<boolean> {
  const tenantModule = await prisma.tenantModule.findFirst({
    where: { tenantId, moduleKey, status: "ENABLED" },
    select: { id: true },
  });
  return Boolean(tenantModule);
}

export async function requireTenantModule(tenantId: string, moduleKey: TenantModuleKey): Promise<void> {
  if (!(await isTenantModuleEnabled(tenantId, moduleKey))) {
    throw new Error("MODULE_DISABLED");
  }
}

export async function requireProductModule(tenantId: string, moduleKey: ProductModule): Promise<void> {
  const product = await getTenantProductContext(tenantId);
  if (!productHasModule(product, moduleKey)) {
    throw new Error("MODULE_DISABLED");
  }
}

export function tenantModuleErrorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "MODULE_DISABLED";
  if (code === "MODULE_DISABLED") {
    return { error: "Module non active pour ce club", status: 404 };
  }
  return { error: "Acces refuse", status: 403 };
}
