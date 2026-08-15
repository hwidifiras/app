import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { Prisma } from "@prisma/client";

const CREDENTIAL_PREFIX = "WDG1";
const CREDENTIAL_PATTERN = /^WDG1\.([A-Za-z0-9_-]{20,64})\.([A-Za-z0-9_-]{24,64})$/;

function credentialSecret(): string {
  const secret = process.env.ACCESS_CREDENTIAL_SECRET?.trim()
    || process.env.AUTH_SECRET?.trim()
    || process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 16) throw new Error("ACCESS_CREDENTIAL_SECRET_MISSING");
  return secret;
}

function credentialSignature(tenantId: string, credentialId: string): string {
  return createHmac("sha256", credentialSecret())
    .update(`gym-access:v1:${tenantId}:${credentialId}`)
    .digest("base64url");
}

export function buildGymCredentialCode(tenantId: string, credentialId: string): string {
  return `${CREDENTIAL_PREFIX}.${credentialId}.${credentialSignature(tenantId, credentialId)}`;
}

function normalizeScannedValue(rawValue: string): string {
  const raw = rawValue.trim();
  if (!/^https?:\/\//i.test(raw)) return raw;
  try {
    const url = new URL(raw);
    return url.searchParams.get("credential")?.trim() || url.searchParams.get("code")?.trim() || raw;
  } catch {
    return raw;
  }
}

export function credentialFingerprint(rawValue: string): string {
  return createHmac("sha256", credentialSecret())
    .update(`gym-unknown:v1:${normalizeScannedValue(rawValue)}`)
    .digest("hex")
    .slice(0, 32);
}

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export type ResolvedGymCredential =
  | { status: "INVALID"; credential: null; memberId: null; fingerprint: string }
  | {
      status: "ACTIVE" | "REVOKED";
      credential: { id: string; memberId: string; revokedAt: Date | null };
      memberId: string;
      fingerprint: string;
    };

export async function resolveGymCredential(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; credentialCode: string },
): Promise<ResolvedGymCredential> {
  const normalized = normalizeScannedValue(input.credentialCode);
  const fingerprint = credentialFingerprint(normalized);
  const match = CREDENTIAL_PATTERN.exec(normalized);
  if (!match) return { status: "INVALID", credential: null, memberId: null, fingerprint };

  const [, credentialId, suppliedSignature] = match;
  const expectedSignature = credentialSignature(input.tenantId, credentialId);
  if (!secureEqual(suppliedSignature, expectedSignature)) {
    return { status: "INVALID", credential: null, memberId: null, fingerprint };
  }

  const credential = await tx.memberAccessCredential.findFirst({
    where: { id: credentialId, tenantId: input.tenantId },
    select: { id: true, memberId: true, revokedAt: true },
  });
  if (!credential) return { status: "INVALID", credential: null, memberId: null, fingerprint };
  return {
    status: credential.revokedAt ? "REVOKED" : "ACTIVE",
    credential,
    memberId: credential.memberId,
    fingerprint,
  };
}

export async function issueGymCredential(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; memberId: string; actorId: string; replacementReason?: string },
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.tenantId}:gym-credential:${input.memberId}`}))`;
  const member = await tx.member.findFirst({
    where: { id: input.memberId, tenantId: input.tenantId },
    select: { id: true, status: true },
  });
  if (!member) throw new Error("MEMBER_NOT_FOUND");
  if (member.status !== "ACTIVE") throw new Error("MEMBER_ARCHIVED");

  const now = new Date();
  const active = await tx.memberAccessCredential.findFirst({
    where: { tenantId: input.tenantId, memberId: input.memberId, revokedAt: null },
    select: { id: true },
  });
  if (active) {
    await tx.memberAccessCredential.update({
      where: { id: active.id },
      data: {
        revokedAt: now,
        revokedById: input.actorId,
        revokeReason: input.replacementReason?.trim() || "Carte remplacée par une nouvelle émission",
      },
    });
  }

  const credentialId = randomBytes(18).toString("base64url");
  const code = buildGymCredentialCode(input.tenantId, credentialId);
  const created = await tx.memberAccessCredential.create({
    data: {
      id: credentialId,
      tenantId: input.tenantId,
      memberId: input.memberId,
      codeHint: code.slice(-8),
      issuedById: input.actorId,
      issuedAt: now,
    },
  });
  await tx.auditLog.create({
    data: {
      tenantId: input.tenantId,
      action: active ? "GYM_ACCESS_CARD_REPLACED" : "GYM_ACCESS_CARD_ISSUED",
      entityType: "MemberAccessCredential",
      entityId: created.id,
      userId: input.actorId,
      details: JSON.stringify({ memberId: input.memberId, replacedCredentialId: active?.id ?? null, codeHint: created.codeHint }),
    },
  });
  return { credential: created, credentialCode: code };
}

export async function revokeGymCredential(
  tx: Prisma.TransactionClient,
  input: { tenantId: string; credentialId: string; actorId: string; reason: string },
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${input.tenantId}:gym-credential-id:${input.credentialId}`}))`;
  const existing = await tx.memberAccessCredential.findFirst({
    where: { id: input.credentialId, tenantId: input.tenantId },
  });
  if (!existing) throw new Error("CREDENTIAL_NOT_FOUND");
  if (existing.revokedAt) throw new Error("CREDENTIAL_ALREADY_REVOKED");
  const updated = await tx.memberAccessCredential.update({
    where: { id: existing.id },
    data: {
      revokedAt: new Date(),
      revokedById: input.actorId,
      revokeReason: input.reason.trim(),
    },
  });
  await tx.auditLog.create({
    data: {
      tenantId: input.tenantId,
      action: "GYM_ACCESS_CARD_REVOKED",
      entityType: "MemberAccessCredential",
      entityId: updated.id,
      userId: input.actorId,
      details: JSON.stringify({ memberId: updated.memberId, reason: input.reason.trim(), codeHint: updated.codeHint }),
    },
  });
  return updated;
}
