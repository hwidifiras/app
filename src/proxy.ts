import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { isPublicPath } from "@/lib/public-paths";

function nextWithPathHeader(request: NextRequest, headers = new Headers(request.headers)) {
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({
    request: { headers },
  });
}

function loginRedirect(request: NextRequest, reason: "missing" | "invalid") {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: reason === "missing" ? "Non authentifie" : "Session invalide" },
      { status: 401 },
    );
  }

  const url = request.nextUrl.clone();
  if (pathname === "/") {
    url.pathname = "/accueil";
    return NextResponse.redirect(url);
  }

  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return nextWithPathHeader(request);
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return loginRedirect(request, "missing");
  }

  const payload = await verifyAuthToken(token);
  if (!payload) {
    return loginRedirect(request, "invalid");
  }

  const headers = new Headers(request.headers);
  headers.set("x-pathname", pathname);
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
