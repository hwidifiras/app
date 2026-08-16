import { prisma } from "@/lib/prisma";
import { memoizeTenantRequest } from "@/lib/tenant-context";

export function tenantNeedsSelfServeOnboarding(tenantId: string): Promise<boolean> {
  return memoizeTenantRequest(`tenant-onboarding-required:${tenantId}`, async () => {
    const onboarding = await prisma.tenantOnboarding.findUnique({
      where: { tenantId },
      select: { source: true, status: true },
    });
    return onboarding?.source === "SELF_SERVE" && onboarding.status === "IN_PROGRESS";
  });
}
