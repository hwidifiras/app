import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { setAuthSessionCookie } from "@/lib/auth-session";
import { requireAuth } from "@/lib/request-user";

export const runtime = "nodejs";

const updateAccountSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    email: z.string().trim().email().optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: z.string().min(8).optional(),
  })
  .refine((data) => !data.newPassword || data.currentPassword, {
    message: "Le mot de passe actuel est requis pour changer le mot de passe",
    path: ["currentPassword"],
  })
  .refine((data) => !data.email || data.currentPassword, {
    message: "Le mot de passe actuel est requis pour changer l'email",
    path: ["currentPassword"],
  });

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    const user = await prisma.user.findUnique({
      where: { id: auth.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        permissions: { select: { key: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        ...user,
        permissions: user.permissions.map((p) => p.key),
      },
    });
  } catch (e) {
    const code = e instanceof Error ? e.message : "FORBIDDEN";
    return NextResponse.json(
      { error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé" },
      { status: code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }
}

export async function PATCH(request: Request) {
  let auth;
  try {
    auth = await requireAuth(request);
  } catch (e) {
    const code = e instanceof Error ? e.message : "FORBIDDEN";
    return NextResponse.json(
      { error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé" },
      { status: code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation échouée", details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, currentPassword, newPassword } = parsed.data;

  if (!name && !email && !newPassword) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      passwordHash: true,
      permissions: { select: { key: true } },
    },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Compte introuvable ou désactivé" }, { status: 404 });
  }

  if ((email || newPassword) && currentPassword) {
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });
    }
  }

  const nextEmail = email ? email.toLowerCase() : user.email;
  if (nextEmail !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: nextEmail }, select: { id: true } });
    if (existing && existing.id !== user.id) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
    }
  }

  const passwordHash = newPassword ? await hashPassword(newPassword) : undefined;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: name ?? user.name,
      email: nextEmail,
      ...(passwordHash ? { passwordHash } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      permissions: { select: { key: true } },
    },
  });

  const permissions = updated.permissions.map((p) => p.key);

  await setAuthSessionCookie({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    permissions,
  });

  await prisma.auditLog.create({
    data: {
      action: "ACCOUNT_UPDATED",
      entityType: "User",
      entityId: updated.id,
      userId: updated.id,
      details: JSON.stringify({
        nameChanged: Boolean(name),
        emailChanged: Boolean(email),
        passwordChanged: Boolean(newPassword),
      }),
    },
  });

  return NextResponse.json({
    data: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      isActive: updated.isActive,
      permissions,
    },
  });
}
