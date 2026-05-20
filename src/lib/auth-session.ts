import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, signAuthToken, type AuthRole } from "@/lib/auth";

export async function setAuthSessionCookie(user: {
  id: string;
  email: string;
  name: string;
  role: AuthRole;
  permissions: string[];
}) {
  const token = await signAuthToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: user.permissions,
  });

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}
