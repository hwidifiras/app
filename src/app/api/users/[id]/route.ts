import { NextResponse } from "next/server";
import { z } from "zod";

import {
  FULL_STAFF_PERMISSIONS,
  PERMISSIONS,
  parsePermissions,
} from "@/lib/permission-definitions";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/request-user";

export const runtime = "nodejs";

const adminUpdateUserSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().optional(),
  isActive: z.boolean().optional(),
  role: z.enum(["ADMIN", "STAFF"]).optional(),
  accessMode: z.enum(["FULL", "LIMITED"]).optional(),
  permissions: z.array(z.enum(PERMISSIONS)).optional(),
  coachId: z.string().trim().min(1).nullable().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

function authFailure(error: unknown) {
  const code = error instanceof Error ? error.message : "FORBIDDEN";
  return NextResponse.json(
    { error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé" },
    { status: code === "UNAUTHENTICATED" ? 401 : 403 },
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  let admin;
  try {
    admin = await requireAdmin(request);
  } catch (error) {
    return authFailure(error);
  }

  const { id } = await context.params;
  const parsed = adminUpdateUserSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation échouée", details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, isActive, role, accessMode, permissions: requestedPermissions, coachId } = parsed.data;
  if (
    name === undefined &&
    email === undefined &&
    isActive === undefined &&
    role === undefined &&
    accessMode === undefined &&
    requestedPermissions === undefined &&
    coachId === undefined
  ) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const target = await prisma.user.findFirst({
    where: { id, tenantId: admin.tenantId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      coachId: true,
      isActive: true,
      permissions: { select: { key: true } },
    },
  });
  if (!target) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  const nextRole = role ?? target.role;
  if (target.id === admin.id && isActive === false) {
    return NextResponse.json({ error: "Vous ne pouvez pas désactiver votre propre compte" }, { status: 400 });
  }
  if (target.id === admin.id && nextRole !== "ADMIN") {
    return NextResponse.json({ error: "Vous ne pouvez pas retirer votre propre rôle administrateur" }, { status: 400 });
  }

  if (target.role === "ADMIN" && (nextRole !== "ADMIN" || isActive === false)) {
    const otherActiveAdmins = await prisma.user.count({
      where: {
        tenantId: admin.tenantId,
        role: "ADMIN",
        isActive: true,
        id: { not: target.id },
      },
    });
    if (otherActiveAdmins === 0) {
      return NextResponse.json({ error: "Conservez au moins un administrateur actif" }, { status: 409 });
    }
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

  const currentPermissions = parsePermissions(target.permissions.map((permission) => permission.key));
  const nextPermissions = nextRole === "ADMIN"
    ? []
    : accessMode === "FULL"
      ? FULL_STAFF_PERMISSIONS
      : requestedPermissions !== undefined
        ? parsePermissions(requestedPermissions)
        : currentPermissions;
  const nextCoachId = nextRole === "STAFF"
    ? coachId === undefined ? target.coachId : coachId
    : null;
  const coachProfile =
    nextRole === "STAFF" &&
    nextPermissions.length === 1 &&
    nextPermissions[0] === "class.attendance";

  if (coachProfile && !nextCoachId) {
    return NextResponse.json({ error: "Sélectionnez le coach lié à ce compte" }, { status: 400 });
  }

  if (nextCoachId && !nextPermissions.includes("class.attendance")) {
    return NextResponse.json(
      { error: "Un compte coach doit disposer du droit de pointage des cours" },
      { status: 400 },
    );
  }

  if (nextCoachId) {
    const coach = await prisma.coach.findFirst({
      where: { id: nextCoachId, tenantId: admin.tenantId, isActive: true },
      select: { id: true, userAccount: { select: { id: true } } },
    });
    if (!coach) {
      return NextResponse.json({ error: "Coach introuvable ou inactif" }, { status: 400 });
    }
    if (coach.userAccount && coach.userAccount.id !== target.id) {
      return NextResponse.json({ error: "Ce coach possède déjà un compte utilisateur" }, { status: 409 });
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      const updateResult = await tx.user.updateMany({
        where: { id: target.id, tenantId: admin.tenantId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(email !== undefined ? { email: nextEmail } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          role: nextRole,
          coachId: nextCoachId,
        },
      });
      if (updateResult.count !== 1) throw new Error("USER_NOT_FOUND");

      await tx.userPermission.deleteMany({ where: { tenantId: admin.tenantId, userId: target.id } });
      if (nextPermissions.length > 0) {
        await tx.userPermission.createMany({
          data: nextPermissions.map((key) => ({ tenantId: admin.tenantId, userId: target.id, key })),
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Email ou coach déjà utilisé" }, { status: 409 });
    }
    throw error;
  }

  const updated = await prisma.user.findFirstOrThrow({
    where: { id: target.id, tenantId: admin.tenantId },
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

  await prisma.auditLog.create({
    data: {
      tenantId: admin.tenantId,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: updated.id,
      userId: admin.id,
      details: JSON.stringify({
        before: {
          name: target.name,
          email: target.email,
          role: target.role,
          coachId: target.coachId,
          isActive: target.isActive,
          permissions: currentPermissions,
        },
        after: {
          name: updated.name,
          email: updated.email,
          role: updated.role,
          coachId: updated.coachId,
          isActive: updated.isActive,
          permissions: nextPermissions,
        },
      }),
    },
  });

  return NextResponse.json({
    data: {
      ...updated,
      permissions: parsePermissions(updated.permissions.map((permission) => permission.key)),
    },
  });
}
