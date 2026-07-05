import {
  FULL_STAFF_PERMISSIONS,
  PERMISSION_LABELS,
  parsePermissions,
  type PermissionKey,
} from "@/lib/permission-definitions";

export type UserRole = "ADMIN" | "STAFF";
export type UserRoleIntent = "ADMIN" | "RECEPTION" | "COACH";

export function deriveUserRoleIntent(role: UserRole, permissionKeys: string[]): UserRoleIntent {
  if (role === "ADMIN") return "ADMIN";

  const permissions = parsePermissions(permissionKeys);
  const hasReceptionWork =
    permissions.includes("members.manage") ||
    permissions.includes("enrollment.manage") ||
    permissions.includes("payments.manage");

  return hasReceptionWork ? "RECEPTION" : "COACH";
}

export function userRoleIntentLabel(intent: UserRoleIntent) {
  if (intent === "ADMIN") return "Admin";
  if (intent === "RECEPTION") return "Réception";
  return "Coach";
}

export function describeUserRights(role: UserRole, permissionKeys: string[]) {
  if (role === "ADMIN") return "Tous les droits du club";

  const permissions = parsePermissions(permissionKeys);
  if (permissions.length === FULL_STAFF_PERMISSIONS.length) return "Accès complet staff";

  return (
    permissions.map((key: PermissionKey) => PERMISSION_LABELS[key]).join(", ") ||
    "Aucun droit actif"
  );
}
