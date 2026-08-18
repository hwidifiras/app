import { NextResponse } from "next/server";

import { setAuthSessionCookie } from "@/lib/auth-session";
import {
  demoAccountEmail,
  isDemoTenantSlug,
  safeDemoNextPath,
} from "@/lib/demo-workspace";
import { parsePermissions } from "@/lib/permission-definitions";
import { prisma } from "@/lib/prisma";
import { enterTenantContext } from "@/lib/tenant-context";
import { resolveTenantFromRequest } from "@/lib/tenant-resolver";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = await resolveTenantFromRequest(request);
  if (!tenant.ok || !isDemoTenantSlug(tenant.context.tenantSlug)) {
    return NextResponse.json({ error: "Démo introuvable" }, { status: 404 });
  }

  enterTenantContext(tenant.context);

  const user = await prisma.user.findFirst({
    where: {
      tenantId: tenant.context.tenantId,
      email: demoAccountEmail(),
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      permissions: { select: { key: true } },
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Le compte de démonstration n'est pas prêt" },
      { status: 503 },
    );
  }

  const permissions =
    user.role === "ADMIN"
      ? []
      : parsePermissions(user.permissions.map((permission) => permission.key));

  await setAuthSessionCookie({
    id: user.id,
    tenantId: tenant.context.tenantId,
    tenantSlug: tenant.context.tenantSlug,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions,
  });

  const requestUrl = new URL(request.url);
  const destination = new URL(
    safeDemoNextPath(requestUrl.searchParams.get("next")),
    requestUrl.origin,
  );
  destination.searchParams.set("demo", "1");

  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
