import { NextRequest, NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import {
  isDemoMutationAllowed,
  isDemoTenantSlug,
} from "@/lib/demo-workspace";
import { isPublicPath } from "@/lib/public-paths";
import { tenantSlugFromHost } from "@/lib/tenant-host";
import { isAccountCreationDisabled } from "@/lib/offline-account-policy";

const TRUSTED_REQUEST_HEADERS = [
  "x-tenant-id",
  "x-tenant-slug",
  "x-user-id",
  "x-user-role",
  "x-user-email",
  "x-user-name",
];

function setApiNoStoreHeaders(headers: Headers) {
  headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
}

function sanitizedRequestHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  for (const header of TRUSTED_REQUEST_HEADERS) {
    headers.delete(header);
  }
  return headers;
}

function nextWithPathHeader(request: NextRequest, headers = new Headers(request.headers)) {
  headers.set("x-pathname", request.nextUrl.pathname);
  const response = NextResponse.next({
    request: { headers },
  });
  if (request.nextUrl.pathname.startsWith("/api/")) {
    setApiNoStoreHeaders(response.headers);
  }
  return response;
}

function loginRedirect(request: NextRequest, reason: "missing" | "invalid") {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const response = NextResponse.json(
      { error: reason === "missing" ? "Non authentifie" : "Session invalide" },
      { status: 401 },
    );
    setApiNoStoreHeaders(response.headers);
    return response;
  }

  const url = request.nextUrl.clone();
  if (pathname === "/") {
    url.pathname = process.env.OFFLINE_DESKTOP === "1" ? "/login" : "/accueil";
    return NextResponse.redirect(url);
  }

  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

function demoReadOnlyResponse(request: NextRequest) {
  const message = "Mode démonstration : les modifications sont désactivées.";
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const response = NextResponse.json({ error: message, code: "DEMO_READ_ONLY" }, { status: 403 });
    setApiNoStoreHeaders(response.headers);
    return response;
  }

  return new NextResponse(message, {
    status: 403,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (process.env.OFFLINE_DESKTOP === "1") {
    if (!process.env.OFFLINE_ACCESS_TOKEN || request.headers.get("x-offline-access") !== process.env.OFFLINE_ACCESS_TOKEN) {
      return NextResponse.json({ error: "Accès local non autorisé" }, { status: 403 });
    }
    const safe = request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS";
    const origin = request.headers.get("origin");
    const localOrigin = `http://${request.headers.get("host")}`;
    if (!safe && origin && origin !== localOrigin) {
      return NextResponse.json({ error: "Origine non autorisée" }, { status: 403 });
    }
    if (/^\/branding\/club-logo(?:-[a-z0-9-]+)?\.(png|jpg|jpeg|webp)$/.test(pathname) && process.env.GYM_DATA_DIR) {
      const target = request.nextUrl.clone(); target.pathname = `/api/offline${pathname}`;
      return NextResponse.rewrite(target, { request: { headers: sanitizedRequestHeaders(request) } });
    }
    if (isAccountCreationDisabled()) {
      if (pathname === "/offline-setup" || pathname === "/register") return NextResponse.redirect(new URL(process.env.OFFLINE_BUNDLED_RECOVERY === "1" ? "/offline-recovery" : "/login", request.url));
      if (pathname === "/api/offline/setup" || (pathname === "/api/users" && request.method === "POST")) {
        return NextResponse.json({ error: "La création de comptes est désactivée sur cet ordinateur." }, { status: 403 });
      }
    }
    if (/^\/(?:signup|find-workspace|demo|accueil|homepage|auth\/activate|api\/saas-signup|api\/auth\/(?:demo|handoff|register|forgot-password))/.test(pathname)) {
      return pathname.startsWith("/api/") ? NextResponse.json({ error: "Fonction disponible dans l’édition en ligne uniquement" }, { status: 404 }) : NextResponse.redirect(new URL("/login", request.url));
    }
  }
  const tenantSlug = tenantSlugFromHost(request.headers.get("host") ?? request.headers.get("x-forwarded-host"));
  const safeMethod = request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS";

  if (
    isDemoTenantSlug(tenantSlug) &&
    !safeMethod &&
    !isDemoMutationAllowed(pathname)
  ) {
    return demoReadOnlyResponse(request);
  }

  if (isPublicPath(pathname)) {
    const headers = sanitizedRequestHeaders(request);
    headers.set("x-pathname", pathname);
    if (tenantSlug) headers.set("x-tenant-slug", tenantSlug);
    return nextWithPathHeader(request, headers);
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return loginRedirect(request, "missing");
  }

  const payload = await verifyAuthToken(token);
  if (!payload) {
    return loginRedirect(request, "invalid");
  }

  if (!payload.tenantId || !payload.tenantSlug || (tenantSlug && payload.tenantSlug !== tenantSlug)) {
    return loginRedirect(request, "invalid");
  }

  const headers = sanitizedRequestHeaders(request);
  headers.set("x-pathname", pathname);
  headers.set("x-tenant-id", payload.tenantId);
  headers.set("x-tenant-slug", payload.tenantSlug);
  headers.set("x-user-id", payload.userId);
  headers.set("x-user-role", payload.role);
  headers.set("x-user-email", payload.email);
  headers.set("x-user-name", payload.name);

  const response = NextResponse.next({
    request: { headers },
  });
  if (pathname.startsWith("/api/")) {
    setApiNoStoreHeaders(response.headers);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
