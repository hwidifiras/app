import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, verifyAuthToken, type AuthRole } from "@/lib/auth";
import { parsePermissions } from "@/lib/permission-definitions";
import { prisma } from "@/lib/prisma";

export type RequestUser = {
  id: string;
  role: AuthRole;
  email: string;
  name: string;
  permissions: string[];
};

export async function getAuthUser(_request?: Request): Promise<RequestUser | null> {
  void _request;

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyAuthToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      role: true,
      email: true,
      name: true,
      isActive: true,
      permissions: { select: { key: true } },
    },
  });

  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
    permissions: user.role === "ADMIN" ? [] : parsePermissions(user.permissions.map((permission) => permission.key)),
  };
}

export async function requireAuth(request: Request): Promise<RequestUser> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}

export async function requireAdmin(request: Request): Promise<RequestUser> {
  const user = await requireAuth(request);
  if (user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return user;
}
