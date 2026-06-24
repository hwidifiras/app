import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/request-user";

export const runtime = "nodejs";

const adminUpdateUserSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch (e) {
    const code = e instanceof Error ? e.message : "FORBIDDEN";
    return NextResponse.json(
      { error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé" },
      { status: code === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = adminUpdateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation échouée", details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, isActive } = parsed.data;
  if (name === undefined && email === undefined && isActive === undefined) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id, tenantId: admin.tenantId },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  if (!target) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  if (isActive === false && target.id === admin.id) {
    return NextResponse.json({ error: "Vous ne pouvez pas désactiver votre propre compte" }, { status: 400 });
  }

  const nextEmail = email ? email.toLowerCase() : target.email;
  if (nextEmail !== target.email) {
    const existing = await prisma.user.findFirst({
      where: { tenantId: admin.tenantId, email: nextEmail },
      select: { id: true },
    });
    if (existing && existing.id !== target.id) {
      return NextResponse.json({ error: "Cet email est déjà utilisé" }, { status: 409 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email: nextEmail } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
    },
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

  await prisma.auditLog.create({
    data: {
      tenantId: admin.tenantId,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: updated.id,
      userId: admin.id,
      details: JSON.stringify({
        name: updated.name,
        email: updated.email,
        isActive: updated.isActive,
      }),
    },
  });

  return NextResponse.json({ data: updated });
}
