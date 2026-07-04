import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { AUTH_COOKIE_NAME, signAuthToken } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { enterTenantContext } from "@/lib/tenant-context";
import { resolveTenantFromRequest } from "@/lib/tenant-resolver";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const tenant = await resolveTenantFromRequest(request);
  const tenantRateKey = tenant.ok ? tenant.context.tenantSlug : "unknown";
  const rateLimit = checkRateLimit(`login:${tenantRateKey}:${getClientIp(request)}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Trop de tentatives. Reessayez dans quelques minutes." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  if (!tenant.ok) {
    return NextResponse.json({ error: "Espace club introuvable" }, { status: 404 });
  }
  enterTenantContext(tenant.context);

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation echouee", details: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.context.tenantId, email: email.toLowerCase() },
    select: {
      id: true,
      tenantId: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      passwordHash: true,
      permissions: { select: { key: true } },
    },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Identifiants invalides" }, { status: 401 });
  }

  const token = await signAuthToken({
    userId: user.id,
    tenantId: tenant.context.tenantId,
    tenantSlug: tenant.context.tenantSlug,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: user.permissions.map((permission) => permission.key),
  });

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });

  return NextResponse.json({
    data: {
      id: user.id,
      tenantId: tenant.context.tenantId,
      tenantSlug: tenant.context.tenantSlug,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions.map((permission) => permission.key),
    },
  });
}
