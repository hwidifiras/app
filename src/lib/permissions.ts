import { prisma } from "@/lib/prisma";
import {
  FULL_STAFF_PERMISSIONS,
  PERMISSION_LABELS,
  PERMISSIONS,
  parsePermissions,
  type PermissionKey,
} from "@/lib/permission-definitions";
import { requireAuth, type RequestUser } from "@/lib/request-user";

export { FULL_STAFF_PERMISSIONS, PERMISSION_LABELS, PERMISSIONS, parsePermissions };
export type { PermissionKey };

export async function getUserPermissions(userId: string): Promise<PermissionKey[]> {
  const rows = await prisma.userPermission.findMany({
    where: { userId },
    select: { key: true },
  });
  return parsePermissions(rows.map((row) => row.key));
}

export async function userHasPermission(user: RequestUser, permission: PermissionKey): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  const permissions = await getUserPermissions(user.id);
  return permissions.includes(permission);
}

export async function requirePermission(
  request: Request,
  permission: PermissionKey,
): Promise<RequestUser> {
  const user = await requireAuth(request);
  if (!(await userHasPermission(user, permission))) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export function permissionErrorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "FORBIDDEN";
  return {
    error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé",
    status: code === "UNAUTHENTICATED" ? 401 : 403,
  };
}
