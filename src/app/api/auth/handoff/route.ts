import { NextResponse } from "next/server";
import { z } from "zod";

import { AUTH_COOKIE_NAME, shouldUseSecureCookies, signAuthToken } from "@/lib/auth";
import { resolveTenantFromRequest } from "@/lib/tenant-resolver";
import { requireTrustedMutationOrigin } from "@/platform/signup/platform-request";
import { claimWorkspaceHandoff } from "@/platform/signup/workspace-handoff-service";

export const runtime = "nodejs";

const handoffSchema = z.object({
  userId: z.string().trim().min(10).max(64),
  token: z.string().trim().min(20).max(256),
});

function loginFailureRedirect(request: Request) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", "handoff");
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  try {
    requireTrustedMutationOrigin(request);
    const tenant = await resolveTenantFromRequest(request);
    if (!tenant.ok) return loginFailureRedirect(request);

    const contentType = request.headers.get("content-type") ?? "";
    const raw = contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
    const parsed = handoffSchema.safeParse(raw);
    if (!parsed.success) return loginFailureRedirect(request);

    const user = await claimWorkspaceHandoff({
      context: tenant.context,
      userId: parsed.data.userId,
      token: parsed.data.token,
    });
    const authToken = await signAuthToken({
      userId: user.id,
      tenantId: user.tenantId,
      tenantSlug: user.tenantSlug,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
    });
    const response = NextResponse.redirect(new URL("/onboarding", request.url), 303);
    response.cookies.set(AUTH_COOKIE_NAME, authToken, {
      httpOnly: true,
      secure: shouldUseSecureCookies(),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return response;
  } catch {
    return loginFailureRedirect(request);
  }
}
