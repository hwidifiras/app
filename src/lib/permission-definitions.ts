export const PERMISSIONS = [
  "members.manage",
  "enrollment.manage",
  "attendance.manage",
  "payments.manage",
  "catalog.manage",
  "offers.manage",
  "gym.checkin",
  "gym.manage",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "members.manage": "Élèves et foyers",
  "enrollment.manage": "Inscriptions",
  "attendance.manage": "Pointage",
  "payments.manage": "Encaissements",
  "catalog.manage": "Catalogue club",
  "offers.manage": "Offres",
  "gym.checkin": "Acces salle",
  "gym.manage": "Gestion salle",
};

export const FULL_STAFF_PERMISSIONS: PermissionKey[] = [...PERMISSIONS];

export function parsePermissions(input: unknown): PermissionKey[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(PERMISSIONS);
  return [...new Set(input)].filter((key): key is PermissionKey => {
    return typeof key === "string" && allowed.has(key as PermissionKey);
  });
}
