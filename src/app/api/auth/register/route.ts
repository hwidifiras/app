import { NextResponse } from "next/server";
import { z } from "zod";

import { getClubSettings } from "@/lib/club-settings";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  isPublicRegistrationGloballyEnabled,
  resolvePublicRegistrationPolicy,
} from "@/lib/registration-policy";
import { enterTenantContext } from "@/lib/tenant-context";
import { resolveTenantFromRequest } from "@/lib/tenant-resolver";

export const runtime = "nodejs";

const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;

const registerSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(2).max(80),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  if (!isPublicRegistrationGloballyEnabled()) {
    return NextResponse.json({ error: "Inscription publique desactivee" }, { status: 403 });
  }

  const tenant = await resolveTenantFromRequest(request);
  if (!tenant.ok) {
    return NextResponse.json({ error: "Espace club introuvable" }, { status: 404 });
  }
  enterTenantContext(tenant.context);

  const settings = await getClubSettings({ tenantId: tenant.context.tenantId });
  const registrationPolicy = resolvePublicRegistrationPolicy(settings.allowPublicRegister);
  if (!registrationPolicy.enabled) {
    return NextResponse.json({ error: "Inscription publique desactivee" }, { status: 403 });
  }

  const rateLimit = await checkRateLimit(
    `register:${tenant.context.tenantSlug}:${getClientIp(request)}`,
    REGISTER_LIMIT,
    REGISTER_WINDOW_MS,
  );
  if (!rateLimit.allowed) {
    if (rateLimit.reason === "unavailable") {
      return NextResponse.json(
        { error: "Service d'inscription temporairement indisponible." },
        { status: 503, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
      );
    }
    return NextResponse.json(
      { error: "Trop de demandes d'inscription. Reessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

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
  const passwordHash = await hashPassword(parsed.data.password);

  let user: {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    permissions: Array<{ key: string }>;
  };
  try {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          tenantId: tenant.context.tenantId,
          email,
          name: parsed.data.name,
          passwordHash,
          role: "STAFF",
          isActive: false,
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

      await tx.auditLog.create({
        data: {
          tenantId: tenant.context.tenantId,
          action: "USER_REGISTERED",
          entityType: "User",
          entityId: created.id,
          details: JSON.stringify({
            email: created.email,
            role: created.role,
            isActive: created.isActive,
            approvalStatus: "PENDING",
            permissions: [],
          }),
        },
      });

      return created;
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Email deja utilise" }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json(
    {
      data: {
        id: user.id,
        tenantId: tenant.context.tenantId,
        tenantSlug: tenant.context.tenantSlug,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        permissions: user.permissions.map((permission) => permission.key),
        approvalStatus: "PENDING",
        message: "Demande creee. Un administrateur du club doit approuver votre acces.",
      },
    },
    { status: 201 },
  );
}
