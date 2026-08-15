import {
  FULL_STAFF_PERMISSIONS,
  PERMISSION_LABELS,
  parsePermissions,
  type PermissionKey,
} from "@/lib/permission-definitions";

export type UserRole = "ADMIN" | "STAFF";
export type UserRoleIntent = "ADMIN" | "MANAGER" | "RECEPTION" | "COACH";

export function deriveUserRoleIntent(
  role: UserRole,
  permissionKeys: string[],
  coachId?: string | null,
): UserRoleIntent {
  if (role === "ADMIN") return "ADMIN";
  if (coachId) return "COACH";

  const permissions = parsePermissions(permissionKeys);
  const hasManagementWork =
    permissions.includes("settings.manage") ||
    permissions.includes("class.manage") ||
    permissions.includes("gym.manage") ||
    permissions.includes("plans.manage") ||
    permissions.includes("payments.correct") ||
    permissions.includes("subscriptions.correct");
  if (hasManagementWork) return "MANAGER";

  const hasReceptionWork =
    permissions.includes("members.manage") ||
    permissions.includes("enrollment.sell") ||
    permissions.includes("payments.collect") ||
    permissions.includes("gym.checkin");

  return hasReceptionWork ? "RECEPTION" : "COACH";
}

export function userRoleIntentLabel(intent: UserRoleIntent) {
  if (intent === "ADMIN") return "Admin";
  if (intent === "MANAGER") return "Responsable";
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
