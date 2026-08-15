import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  FULL_STAFF_PERMISSIONS,
  hasPermission,
  PERMISSION_LABELS,
  PERMISSIONS,
  parsePermissions,
  type PermissionKey,
} from "@/lib/permission-definitions";
import { requireAuth, type RequestUser } from "@/lib/request-user";

export { FULL_STAFF_PERMISSIONS, PERMISSION_LABELS, PERMISSIONS, hasPermission, parsePermissions };
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
  return hasPermission(user.permissions, permission);
}

export async function userHasAnyPermission(user: RequestUser, permissions: PermissionKey[]): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  return permissions.some((permission) => hasPermission(user.permissions, permission));
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

export async function requireAnyPermission(
  request: Request,
  permissions: PermissionKey[],
): Promise<RequestUser> {
  const user = await requireAuth(request);
  if (!(await userHasAnyPermission(user, permissions))) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export function permissionErrorResponse(error: unknown) {
  const code = error instanceof Error ? error.message : "FORBIDDEN";
  if (code === "MODULE_DISABLED") {
    return { error: "Module non actif pour ce club", status: 404 };
  }
  if (code === "TENANT_PRODUCT_UNCONFIGURED") {
    return { error: "Modules du club non configurés", status: 503 };
  }
  if (code === "SAAS_SUBSCRIPTION_BLOCKED") {
    return { error: "Abonnement du club suspendu", status: 423 };
  }
  return {
    error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé",
    status: code === "UNAUTHENTICATED" ? 401 : 403,
  };
}

export function jsonAuthFailureResponse(error: unknown) {
  const { error: message, status } = permissionErrorResponse(error);
  return NextResponse.json({ error: message }, { status });
}
