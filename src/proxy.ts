import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";

const permissionRules: Array<{ paths: string[]; permission: string }> = [
  { paths: ["/enrollment", "/api/enrollment", "/api/group-members"], permission: "enrollment.manage" },
  { paths: ["/attendance", "/api/attendances"], permission: "attendance.manage" },
  { paths: ["/payments", "/api/payments"], permission: "payments.manage" },
  { paths: ["/offers", "/api/offers"], permission: "offers.manage" },
  {
    paths: [
      "/sports",
      "/coaches",
      "/groups",
      "/sessions",
      "/subscription-plans",
      "/subscriptions",
      "/api/sports",
      "/api/coaches",
      "/api/groups",
      "/api/sessions",
      "/api/subscription-plans",
      "/api/member-subscriptions",
    ],
    permission: "catalog.manage",
  },
  {
    paths: ["/members", "/api/members", "/api/households"],
    permission: "members.manage",
  },
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname === "/register") return true;
  if (pathname === "/forgot-password") return true;
  if (pathname === "/reset-password") return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

function requiredPermissionForPath(pathname: string): string | null {
  for (const rule of permissionRules) {
    if (rule.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
      return rule.permission;
    }
  }
  return null;
}

function forbiddenResponse(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("denied", "1");
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const payload = await verifyAuthToken(token);

  if (!payload) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Session invalide" }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (
    pathname.startsWith("/settings/users") ||
    pathname.startsWith("/settings/club") ||
    pathname.startsWith("/api/users") ||
    pathname.startsWith("/api/club-settings")
  ) {
    if (payload.role !== "ADMIN") return forbiddenResponse(request);
  }

  if (payload.role !== "ADMIN") {
    const requiredPermission = requiredPermissionForPath(pathname);
    const permissions = payload.permissions ?? [];
    if (requiredPermission && !permissions.includes(requiredPermission)) {
      return forbiddenResponse(request);
    }
  }

  const headers = new Headers(request.headers);
  headers.set("x-user-id", payload.userId);
  headers.set("x-user-role", payload.role);
  headers.set("x-user-email", payload.email);
  headers.set("x-user-name", payload.name);

  return NextResponse.next({
    request: { headers },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
