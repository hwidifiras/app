import type { AuthRole } from "@/lib/auth";

export type RequestUser = {
  id: string;
  role: AuthRole;
  email: string;
  name: string;
};

export function getRequestUser(request: Request): RequestUser | null {
  const id = request.headers.get("x-user-id")?.trim();
  const role = request.headers.get("x-user-role")?.trim();
  const email = request.headers.get("x-user-email")?.trim();
  const name = request.headers.get("x-user-name")?.trim();

  if (!id || !role || !email || !name) return null;
  if (role !== "ADMIN" && role !== "STAFF") return null;

  return { id, role, email, name };
}

export function requireAdmin(request: Request): RequestUser {
  const user = getRequestUser(request);
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  if (user.role !== "ADMIN") {
    throw new Error("FORBIDDEN");
  }
  return user;
}
