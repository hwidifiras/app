import { NextResponse } from "next/server";

import { getClubSettings } from "@/lib/club-settings";
import { buildGymCredentialQrDataUrl } from "@/lib/gym-card";
import { jsonAuthFailureResponse, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { gymCredentialIssueSchema, gymCredentialRevokeSchema } from "@/lib/schemas/gym";
import { requireTenantModule, tenantModuleErrorResponse } from "@/lib/tenant-modules";
import {
  buildGymCredentialCode,
  issueGymCredential,
  revokeGymCredential,
} from "@/modules/gym/access-credentials";

export const runtime = "nodejs";

async function authorize(request: Request) {
  const actor = await requirePermission(request, "gym.manage");
  await requireTenantModule(actor.tenantId, "GYM_ACCESS");
  return actor;
}

function authFailure(error: unknown) {
  if (error instanceof Error && error.message === "MODULE_DISABLED") {
    const failure = tenantModuleErrorResponse(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
  return jsonAuthFailureResponse(error);
}

async function cardPayload(tenantId: string, credential: { id: string; codeHint: string; issuedAt: Date; memberId: string }) {
  const [member, settings] = await Promise.all([
    prisma.member.findFirst({
      where: { id: credential.memberId, tenantId },
      select: { id: true, firstName: true, lastName: true, phone: true },
    }),
    getClubSettings({ tenantId }),
  ]);
  if (!member) throw new Error("MEMBER_NOT_FOUND");
  const credentialCode = buildGymCredentialCode(tenantId, credential.id);
  return {
    credential: {
      id: credential.id,
      codeHint: credential.codeHint,
      issuedAt: credential.issuedAt.toISOString(),
      credentialCode,
      qrDataUrl: await buildGymCredentialQrDataUrl(credentialCode),
    },
    member,
    club: {
      name: settings.clubName || "Club",
      logoUrl: settings.clubLogoUrl,
      phone: settings.clubPhone,
    },
  };
}

export async function GET(request: Request) {
  let actor;
  try {
    actor = await authorize(request);
  } catch (error) {
    return authFailure(error);
  }
  const memberId = new URL(request.url).searchParams.get("memberId")?.trim();
  if (!memberId) return NextResponse.json({ error: "memberId requis" }, { status: 400 });

  const credential = await prisma.memberAccessCredential.findFirst({
    where: { tenantId: actor.tenantId, memberId, revokedAt: null },
    select: { id: true, codeHint: true, issuedAt: true, memberId: true },
  });
  if (!credential) return NextResponse.json({ data: null });
  try {
    return NextResponse.json({ data: await cardPayload(actor.tenantId, credential) });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBER_NOT_FOUND") {
      return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  let actor;
  try {
    actor = await authorize(request);
  } catch (error) {
    return authFailure(error);
  }
  const parsed = gymCredentialIssueSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Membre ou motif invalide", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction((tx) => issueGymCredential(tx, {
      tenantId: actor.tenantId,
      memberId: parsed.data.memberId,
      actorId: actor.id,
      replacementReason: parsed.data.replacementReason,
    }));
    const data = await cardPayload(actor.tenantId, result.credential);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "MEMBER_NOT_FOUND") return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
    if (code === "MEMBER_ARCHIVED") return NextResponse.json({ error: "Une carte ne peut pas être créée pour un membre résilié" }, { status: 409 });
    console.error("[POST /api/gym/credentials]", error);
    return NextResponse.json({ error: "Création de la carte impossible" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let actor;
  try {
    actor = await authorize(request);
  } catch (error) {
    return authFailure(error);
  }
  const parsed = gymCredentialRevokeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Un motif précis est obligatoire", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const credential = await prisma.$transaction((tx) => revokeGymCredential(tx, {
      tenantId: actor.tenantId,
      credentialId: parsed.data.credentialId,
      actorId: actor.id,
      reason: parsed.data.reason,
    }));
    return NextResponse.json({ data: { id: credential.id, revokedAt: credential.revokedAt } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "CREDENTIAL_NOT_FOUND") return NextResponse.json({ error: "Carte introuvable" }, { status: 404 });
    if (code === "CREDENTIAL_ALREADY_REVOKED") return NextResponse.json({ error: "Cette carte est déjà révoquée" }, { status: 409 });
    console.error("[DELETE /api/gym/credentials]", error);
    return NextResponse.json({ error: "Révocation de la carte impossible" }, { status: 500 });
  }
}
