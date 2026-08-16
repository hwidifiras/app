import type { TenantModuleKey, WorkspaceEdition } from "@prisma/client";

const PLAN_CODE_BY_EDITION: Record<WorkspaceEdition, string> = {
  CLASS: "CLASS",
  GYM: "GYM",
  HYBRID: "HYBRID",
};

const MODULES_BY_EDITION: Record<WorkspaceEdition, readonly TenantModuleKey[]> = {
  CLASS: ["CLASS_MANAGEMENT"],
  GYM: ["GYM_ACCESS"],
  HYBRID: ["CLASS_MANAGEMENT", "GYM_ACCESS"],
};

export function saasPlanCodeForEdition(edition: WorkspaceEdition): string {
  return PLAN_CODE_BY_EDITION[edition];
}

export function productModulesForEdition(edition: WorkspaceEdition): readonly TenantModuleKey[] {
  return MODULES_BY_EDITION[edition];
}
