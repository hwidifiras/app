export const PERMISSIONS = [
  "members.manage",
  "enrollment.sell",
  "payments.collect",
  "payments.correct",
  "subscriptions.correct",
  "plans.manage",
  "class.attendance",
  "class.manage",
  "gym.checkin",
  "gym.correct",
  "gym.manage",
  "reports.finance",
  "settings.manage",
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number];

export const LEGACY_PERMISSIONS = [
  "enrollment.manage",
  "attendance.manage",
  "payments.manage",
  "catalog.manage",
  "offers.manage",
] as const;

export type LegacyPermissionKey = (typeof LEGACY_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  "members.manage": "Membres et foyers",
  "enrollment.sell": "Inscriptions et ventes",
  "payments.collect": "Encaissements",
  "payments.correct": "Corrections de caisse",
  "subscriptions.correct": "Corrections d'abonnements",
  "plans.manage": "Formules et offres",
  "class.attendance": "Pointage des cours",
  "class.manage": "Cours, coachs et planning",
  "gym.checkin": "Contrôle d'accès salle",
  "gym.correct": "Corrections des passages salle",
  "gym.manage": "Gestion de la salle",
  "reports.finance": "Rapports financiers",
  "settings.manage": "Réglages du club",
};

export const FULL_STAFF_PERMISSIONS: PermissionKey[] = [...PERMISSIONS];

const LEGACY_PERMISSION_GRANTS: Record<LegacyPermissionKey, readonly PermissionKey[]> = {
  "enrollment.manage": ["enrollment.sell"],
  "attendance.manage": ["class.attendance"],
  "payments.manage": ["payments.collect", "payments.correct", "reports.finance"],
  "catalog.manage": ["class.manage", "plans.manage", "subscriptions.correct"],
  "offers.manage": ["plans.manage"],
};

const permissionSet = new Set<string>(PERMISSIONS);
const legacyPermissionSet = new Set<string>(LEGACY_PERMISSIONS);

export function parsePermissions(input: unknown): PermissionKey[] {
  if (!Array.isArray(input)) return [];

  const resolved = new Set<PermissionKey>();
  for (const value of input) {
    if (typeof value !== "string") continue;
    if (permissionSet.has(value)) {
      resolved.add(value as PermissionKey);
      continue;
    }
    if (legacyPermissionSet.has(value)) {
      for (const permission of LEGACY_PERMISSION_GRANTS[value as LegacyPermissionKey]) {
        resolved.add(permission);
      }
    }
  }

  return PERMISSIONS.filter((permission) => resolved.has(permission));
}

export function hasPermission(input: unknown, permission: PermissionKey) {
  return parsePermissions(input).includes(permission);
}

export function canonicalPermissionsForStoredKey(key: string): PermissionKey[] {
  return parsePermissions([key]);
}
