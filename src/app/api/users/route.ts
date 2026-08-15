import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireAdmin } from "@/lib/request-user";
import {
  FULL_STAFF_PERMISSIONS,
  PERMISSIONS,
  parsePermissions,
} from "@/lib/permissions";

export const runtime = "nodejs";

const createUserSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(2).max(80),
  role: z.enum(["ADMIN", "STAFF"]).default("STAFF"),
  password: z.string().min(8),
  accessMode: z.enum(["FULL", "LIMITED"]).default("LIMITED"),
  permissions: z.array(z.enum(PERMISSIONS)).optional(),
  coachId: z.string().trim().min(1).nullable().optional(),
});

export async function GET(request: Request) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch (e) {
    const code = e instanceof Error ? e.message : "FORBIDDEN";
    return NextResponse.json({ error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé" }, { status: code === "UNAUTHENTICATED" ? 401 : 403 });
  }

  const users = await prisma.user.findMany({
    where: { tenantId: admin.tenantId },
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      coachId: true,
      coach: { select: { firstName: true, lastName: true } },
      isActive: true,
      createdAt: true,
      permissions: { where: { tenantId: admin.tenantId }, select: { key: true } },
    },
    take: 200,
  });

  return NextResponse.json({
    data: users.map((user) => ({
      ...user,
      permissions: user.role === "ADMIN" ? FULL_STAFF_PERMISSIONS : parsePermissions(user.permissions.map((p) => p.key)),
    })),
  });
}

export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch (e) {
    const code = e instanceof Error ? e.message : "FORBIDDEN";
    return NextResponse.json({ error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé" }, { status: code === "UNAUTHENTICATED" ? 401 : 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation échouée", details: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();

  const existing = await prisma.user.findFirst({ where: { tenantId: admin.tenantId, email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "Email déjà utilisé" }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const permissions =
    parsed.data.role === "ADMIN"
      ? []
      : parsed.data.accessMode === "FULL"
        ? FULL_STAFF_PERMISSIONS
        : parsePermissions(parsed.data.permissions ?? []);
  const coachId = parsed.data.role === "STAFF" ? parsed.data.coachId ?? null : null;
  const coachProfile =
    parsed.data.role === "STAFF" &&
    permissions.length === 1 &&
    permissions[0] === "class.attendance";

  if (coachProfile && !coachId) {
    return NextResponse.json({ error: "Sélectionnez le coach lié à ce compte" }, { status: 400 });
  }

  if (coachId && !permissions.includes("class.attendance")) {
    return NextResponse.json(
      { error: "Un compte coach doit disposer du droit de pointage des cours" },
      { status: 400 },
    );
  }

  if (coachId) {
    const coach = await prisma.coach.findFirst({
      where: { id: coachId, tenantId: admin.tenantId, isActive: true },
      select: { id: true, userAccount: { select: { id: true } } },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach introuvable ou inactif" }, { status: 400 });
    }
    if (coach.userAccount) {
      return NextResponse.json({ error: "Ce coach possède déjà un compte utilisateur" }, { status: 409 });
    }
  }

  let user;
  try {
    user = await prisma.user.create({
      data: {
        tenantId: admin.tenantId,
        email,
        name: parsed.data.name,
        role: parsed.data.role,
        coachId,
        passwordHash,
        permissions: {
          create: permissions.map((key) => ({ tenantId: admin.tenantId, key })),
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        coachId: true,
        coach: { select: { firstName: true, lastName: true } },
        isActive: true,
        createdAt: true,
        permissions: { select: { key: true } },
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Email ou coach déjà utilisé" }, { status: 409 });
    }
    throw error;
  }

  await prisma.auditLog.create({
    data: {
      tenantId: admin.tenantId,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      userId: admin.id,
      details: JSON.stringify({ tenantId: admin.tenantId, email: user.email, role: user.role, coachId, permissions }),
    },
  });

  return NextResponse.json(
    { data: { ...user, permissions: parsePermissions(user.permissions.map((p) => p.key)) } },
    { status: 201 },
  );
}
