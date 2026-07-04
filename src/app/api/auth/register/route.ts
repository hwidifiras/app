import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { enterTenantContext } from "@/lib/tenant-context";
import { resolveTenantFromRequest } from "@/lib/tenant-resolver";

export const runtime = "nodejs";

function isPublicRegisterEnabled(): boolean {
  return process.env.ALLOW_PUBLIC_REGISTER === "true";
}

const registerSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(2).max(80),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  if (!isPublicRegisterEnabled()) {
    return NextResponse.json({ error: "Inscription publique desactivee" }, { status: 403 });
  }

  const tenant = await resolveTenantFromRequest(request);
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

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation echouee", details: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();

  const existing = await prisma.user.findFirst({ where: { tenantId: tenant.context.tenantId, email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "Email deja utilise" }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.context.tenantId,
      email,
      name: parsed.data.name,
      passwordHash,
      role: "STAFF",
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.context.tenantId,
      action: "USER_REGISTERED",
      entityType: "User",
      entityId: user.id,
      details: JSON.stringify({ email: user.email, role: user.role }),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json(
    {
      data: {
        id: user.id,
        tenantId: tenant.context.tenantId,
        tenantSlug: tenant.context.tenantSlug,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    },
    { status: 201 },
  );
}
