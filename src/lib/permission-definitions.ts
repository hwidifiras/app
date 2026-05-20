export const PERMISSIONS = [
  "members.manage",
  "enrollment.manage",
  "attendance.manage",
  "payments.manage",
  "catalog.manage",
  "offers.manage",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "members.manage": "Gérer les élèves et foyers",
  "enrollment.manage": "Faire les inscriptions",
  "attendance.manage": "Gérer les présences",
  "payments.manage": "Gérer les paiements",
  "catalog.manage": "Gérer disciplines, cours et formules",
  "offers.manage": "Gérer les offres",
};

export const FULL_STAFF_PERMISSIONS: PermissionKey[] = [...PERMISSIONS];

export function parsePermissions(input: unknown): PermissionKey[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(PERMISSIONS);
  return [...new Set(input)].filter((key): key is PermissionKey => {
    return typeof key === "string" && allowed.has(key as PermissionKey);
  });
}
