import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, verifyAuthToken, type AuthRole } from "@/lib/auth";

export type RequestUser = {
  id: string;
  role: AuthRole;
  email: string;
  name: string;
  permissions: string[];
};

export async function getAuthUser(request: Request): Promise<RequestUser | null> {
  void request;
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyAuthToken(token);
  if (!payload) return null;

  return {
    id: payload.userId,
    role: payload.role,
    email: payload.email,
    name: payload.name,
    permissions: payload.permissions ?? [],
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
