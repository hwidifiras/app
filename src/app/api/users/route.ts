import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireAdmin } from "@/lib/request-user";

export const runtime = "nodejs";

const createUserSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(2).max(80),
  role: z.enum(["ADMIN", "STAFF"]).default("STAFF"),
  password: z.string().min(8),
});

export async function GET(request: Request) {
  try {
    requireAdmin(request);
  } catch (e) {
    const code = e instanceof Error ? e.message : "FORBIDDEN";
    return NextResponse.json({ error: code === "UNAUTHENTICATED" ? "Non authentifié" : "Accès refusé" }, { status: code === "UNAUTHENTICATED" ? 401 : 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    take: 200,
  });

  return NextResponse.json({ data: users });
}

export async function POST(request: Request) {
  let admin;
  try {
    admin = requireAdmin(request);
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

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ error: "Email déjà utilisé" }, { status: 409 });
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      role: parsed.data.role,
      passwordHash,
    },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });

  await prisma.auditLog.create({
    data: {
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      userId: admin.id,
      details: JSON.stringify({ email: user.email, role: user.role }),
    },
  });

  return NextResponse.json({ data: user }, { status: 201 });
}
