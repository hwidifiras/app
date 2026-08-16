import { randomUUID } from "node:crypto";

import type { WorkspaceSignupStatus } from "@prisma/client";

import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/serializable-transaction";
import { ACTIVITY_TEMPLATE_CATALOG_VERSION } from "@/platform/onboarding/activity-templates";
import { resolveSaasSignupConfig } from "@/platform/signup/signup-config";
import {
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  type SignupStartInput,
} from "@/platform/signup/signup-schemas";
import {
  createSignupVerificationSecrets,
  hashSignupIdempotencyKey,
  hashSignupInviteToken,
  hashSignupVerificationCode,
  hashSignupVerificationToken,
  secureHashEqual,
  signupRequestFingerprint,
} from "@/platform/signup/signup-security";
import { SignupServiceError } from "@/platform/signup/signup-errors";
import {
  sendWorkspaceVerificationEmail,
  signupVerificationUrl,
  type SignupEmailDelivery,
} from "@/platform/signup/signup-email";
import { validateWorkspaceSlug, workspaceHostForSlug } from "@/platform/signup/workspace-slug";

const SIGNUP_LIFETIME_MS = 24 * 60 * 60 * 1_000;
const VERIFICATION_LIFETIME_MS = 30 * 60 * 1_000;
const RESEND_COOLDOWN_MS = 60 * 1_000;

type VerificationDelivery = {
  delivery: SignupEmailDelivery;
  developmentVerification?: { code: string; url: string };
};

export type WorkspaceSignupState = {
  signupId: string;
  status: WorkspaceSignupStatus;
  email: string;
  ownerName: string;
  emailVerified: boolean;
  clubName: string | null;
  clubPhone: string;
  clubAddress: string;
  requestedSlug: string | null;
  edition: "CLASS" | "GYM" | "HYBRID" | null;
  activityTemplateKeys: string[];
  tenantId: string | null;
  expiresAt: Date;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isInviteUsable(invite: {
  email: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  useCount: number;
  maxUses: number;
}, email: string, now: Date): boolean {
  return (
    !invite.revokedAt
    && invite.expiresAt > now
    && invite.useCount < invite.maxUses
    && (!invite.email || invite.email === email)
  );
}

function stateFromRow(row: {
  id: string;
  status: WorkspaceSignupStatus;
  email: string;
  ownerName: string;
  emailVerifiedAt: Date | null;
  clubName: string | null;
  clubPhone: string;
  clubAddress: string;
  requestedSlug: string | null;
  edition: "CLASS" | "GYM" | "HYBRID" | null;
  activityTemplateKeys: string[];
  tenantId: string | null;
  expiresAt: Date;
}): WorkspaceSignupState {
  return {
    signupId: row.id,
    status: row.status,
    email: row.email,
    ownerName: row.ownerName,
    emailVerified: Boolean(row.emailVerifiedAt),
    clubName: row.clubName,
    clubPhone: row.clubPhone,
    clubAddress: row.clubAddress,
    requestedSlug: row.requestedSlug,
    edition: row.edition,
    activityTemplateKeys: row.activityTemplateKeys,
    tenantId: row.tenantId,
    expiresAt: row.expiresAt,
  };
}

const signupStateSelect = {
  id: true,
  status: true,
  email: true,
  ownerName: true,
  emailVerifiedAt: true,
  clubName: true,
  clubPhone: true,
  clubAddress: true,
  requestedSlug: true,
  edition: true,
  activityTemplateKeys: true,
  tenantId: true,
  expiresAt: true,
} as const;

async function deliverVerification(input: {
  signupId: string;
  email: string;
  ownerName: string;
  code: string;
  token: string;
}): Promise<VerificationDelivery> {
  const url = signupVerificationUrl({ signupId: input.signupId, token: input.token });
  const delivery = await sendWorkspaceVerificationEmail({
    to: input.email,
    ownerName: input.ownerName,
    code: input.code,
    verificationUrl: url,
  });
  return {
    delivery,
    developmentVerification:
      process.env.NODE_ENV === "production" ? undefined : { code: input.code, url },
  };
}

export async function getWorkspaceSignupState(signupId: string): Promise<WorkspaceSignupState> {
  const signup = await prisma.workspaceSignup.findUnique({
    where: { id: signupId },
    select: signupStateSelect,
  });
  if (!signup) throw new SignupServiceError("SIGNUP_SESSION_INVALID", 401);

  if (signup.expiresAt <= new Date() && signup.status !== "COMPLETED" && signup.status !== "EXPIRED") {
    const expired = await prisma.workspaceSignup.update({
      where: { id: signup.id },
      data: { status: "EXPIRED" },
      select: signupStateSelect,
    });
    return stateFromRow(expired);
  }
  return stateFromRow(signup);
}

export async function startWorkspaceSignup(input: {
  data: SignupStartInput;
  clientIp: string;
  idempotencyKey: string;
}): Promise<{ state: WorkspaceSignupState; reused: boolean } & Partial<VerificationDelivery>> {
  const config = resolveSaasSignupConfig();
  if (config.mode === "DISABLED") throw new SignupServiceError("SIGNUP_DISABLED", 404);

  const email = normalizeEmail(input.data.email);
  const fingerprint = signupRequestFingerprint(input.clientIp, email);
  const idempotencyKey = hashSignupIdempotencyKey(input.idempotencyKey);
  const existing = await prisma.workspaceSignup.findUnique({
    where: { idempotencyKey },
    select: { ...signupStateSelect, requestFingerprint: true },
  });
  if (existing) {
    if (existing.email !== email || existing.requestFingerprint !== fingerprint) {
      throw new SignupServiceError("SIGNUP_REQUEST_CONFLICT", 409);
    }
    return { state: stateFromRow(existing), reused: true };
  }

  const now = new Date();
  let inviteId: string | null = null;
  if (config.mode === "INVITE_ONLY" && !input.data.inviteToken) {
    throw new SignupServiceError("SIGNUP_INVITE_REQUIRED", 403);
  }
  if (input.data.inviteToken) {
    const invite = await prisma.workspaceSignupInvite.findUnique({
      where: { tokenHash: hashSignupInviteToken(input.data.inviteToken) },
      select: { id: true, email: true, expiresAt: true, revokedAt: true, useCount: true, maxUses: true },
    });
    if (!invite || !isInviteUsable(invite, email, now)) {
      throw new SignupServiceError("SIGNUP_INVITE_INVALID", 403);
    }
    inviteId = invite.id;
  }

  const signupId = randomUUID();
  const secrets = createSignupVerificationSecrets(signupId);
  const passwordHash = await hashPassword(input.data.password);
  const signup = await runSerializableTransaction(async (tx) => {
    const raced = await tx.workspaceSignup.findUnique({
      where: { idempotencyKey },
      select: { ...signupStateSelect, requestFingerprint: true },
    });
    if (raced) {
      if (raced.email !== email || raced.requestFingerprint !== fingerprint) {
        throw new SignupServiceError("SIGNUP_REQUEST_CONFLICT", 409);
      }
      return { row: raced, created: false };
    }

    if (inviteId) {
      const invite = await tx.workspaceSignupInvite.findUnique({
        where: { id: inviteId },
        select: { email: true, expiresAt: true, revokedAt: true, useCount: true, maxUses: true },
      });
      if (!invite || !isInviteUsable(invite, email, now)) {
        throw new SignupServiceError("SIGNUP_INVITE_INVALID", 403);
      }
    }

    const row = await tx.workspaceSignup.create({
      data: {
        id: signupId,
        email,
        ownerName: input.data.ownerName.trim(),
        passwordHash,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        termsAcceptedAt: now,
        expiresAt: new Date(now.getTime() + SIGNUP_LIFETIME_MS),
        requestFingerprint: fingerprint,
        idempotencyKey,
        inviteId,
        templateCatalogVersion: ACTIVITY_TEMPLATE_CATALOG_VERSION,
        verificationTokens: {
          create: {
            tokenHash: secrets.tokenHash,
            codeHash: secrets.codeHash,
            expiresAt: new Date(now.getTime() + VERIFICATION_LIFETIME_MS),
          },
        },
      },
      select: signupStateSelect,
    });
    return { row, created: true };
  });

  if (!signup.created) return { state: stateFromRow(signup.row), reused: true };
  const delivered = await deliverVerification({
    signupId,
    email,
    ownerName: input.data.ownerName.trim(),
    code: secrets.code,
    token: secrets.token,
  });
  return { state: stateFromRow(signup.row), reused: false, ...delivered };
}

export async function resendWorkspaceVerification(signupId: string): Promise<VerificationDelivery> {
  const now = new Date();
  const secrets = createSignupVerificationSecrets(signupId);
  const result = await runSerializableTransaction(async (tx) => {
    const signup = await tx.workspaceSignup.findUnique({
      where: { id: signupId },
      select: {
        id: true,
        status: true,
        email: true,
        ownerName: true,
        expiresAt: true,
        verificationTokens: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });
    if (!signup) return { error: "SIGNUP_SESSION_INVALID" as const };
    if (signup.status === "VERIFIED" || signup.status === "COMPLETED") {
      return { error: "SIGNUP_ALREADY_COMPLETED" as const };
    }
    if (signup.status !== "PENDING_EMAIL" || signup.expiresAt <= now) {
      await tx.workspaceSignup.updateMany({
        where: { id: signup.id, status: { not: "COMPLETED" } },
        data: { status: "EXPIRED" },
      });
      return { error: "SIGNUP_EXPIRED" as const };
    }
    const latest = signup.verificationTokens[0]?.createdAt;
    if (latest && now.getTime() - latest.getTime() < RESEND_COOLDOWN_MS) {
      return {
        error: "SIGNUP_RESEND_COOLDOWN" as const,
        retryAfterSeconds: Math.max(1, Math.ceil((RESEND_COOLDOWN_MS - (now.getTime() - latest.getTime())) / 1_000)),
      };
    }

    await tx.signupVerificationToken.updateMany({
      where: { signupId, usedAt: null, invalidatedAt: null },
      data: { invalidatedAt: now },
    });
    await tx.signupVerificationToken.create({
      data: {
        signupId,
        tokenHash: secrets.tokenHash,
        codeHash: secrets.codeHash,
        expiresAt: new Date(now.getTime() + VERIFICATION_LIFETIME_MS),
      },
    });
    return { signup };
  });

  if ("error" in result && result.error) {
    const code = result.error;
    const status = code === "SIGNUP_RESEND_COOLDOWN" ? 429 : code === "SIGNUP_SESSION_INVALID" ? 401 : 400;
    throw new SignupServiceError(code, status, result.retryAfterSeconds);
  }
  return deliverVerification({
    signupId,
    email: result.signup.email,
    ownerName: result.signup.ownerName,
    code: secrets.code,
    token: secrets.token,
  });
}

export async function verifyWorkspaceSignup(input: {
  signupId: string;
  code?: string;
  token?: string;
}): Promise<WorkspaceSignupState> {
  const now = new Date();
  const result = await runSerializableTransaction(async (tx) => {
    const signup = await tx.workspaceSignup.findUnique({
      where: { id: input.signupId },
      select: signupStateSelect,
    });
    if (!signup) return { error: "SIGNUP_SESSION_INVALID" as const };
    if (signup.status === "VERIFIED" || signup.status === "COMPLETED") return { signup };
    if (signup.status !== "PENDING_EMAIL" || signup.expiresAt <= now) {
      await tx.workspaceSignup.updateMany({
        where: { id: signup.id, status: { not: "COMPLETED" } },
        data: { status: "EXPIRED" },
      });
      return { error: "SIGNUP_EXPIRED" as const };
    }

    const verification = await tx.signupVerificationToken.findFirst({
      where: {
        signupId: input.signupId,
        usedAt: null,
        invalidatedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!verification || verification.attemptCount >= verification.maxAttempts) {
      return { error: "SIGNUP_VERIFICATION_LOCKED" as const };
    }

    const suppliedHash = input.token
      ? hashSignupVerificationToken(input.signupId, input.token)
      : hashSignupVerificationCode(input.signupId, input.code ?? "");
    const expectedHash = input.token ? verification.tokenHash : verification.codeHash;
    if (!secureHashEqual(suppliedHash, expectedHash)) {
      const attemptCount = verification.attemptCount + 1;
      await tx.signupVerificationToken.update({
        where: { id: verification.id },
        data: {
          attemptCount,
          invalidatedAt: attemptCount >= verification.maxAttempts ? now : undefined,
        },
      });
      return {
        error: attemptCount >= verification.maxAttempts
          ? "SIGNUP_VERIFICATION_LOCKED" as const
          : "SIGNUP_VERIFICATION_INVALID" as const,
      };
    }

    await tx.signupVerificationToken.update({
      where: { id: verification.id },
      data: { usedAt: now },
    });
    const verified = await tx.workspaceSignup.update({
      where: { id: signup.id },
      data: { status: "VERIFIED", emailVerifiedAt: now, failureCode: null },
      select: signupStateSelect,
    });
    return { signup: verified };
  });

  if ("error" in result && result.error) {
    const code = result.error;
    const status = code === "SIGNUP_SESSION_INVALID" ? 401 : 400;
    throw new SignupServiceError(code, status);
  }
  return stateFromRow(result.signup);
}

export async function workspaceSlugAvailability(value: string): Promise<{
  available: boolean;
  slug: string;
  reason?: "EMPTY" | "FORMAT" | "RESERVED" | "TAKEN";
}> {
  const validation = validateWorkspaceSlug(value);
  if (!validation.valid) {
    return { available: false, slug: validation.slug, reason: validation.reason };
  }
  const tenant = await prisma.tenant.findUnique({
    where: { slug: validation.slug },
    select: { id: true },
  });
  const aliasTenant = tenant ? null : await prisma.tenant.findUnique({
    where: { rootDomainAlias: workspaceHostForSlug(validation.slug) },
    select: { id: true },
  });
  return tenant || aliasTenant
    ? { available: false, slug: validation.slug, reason: "TAKEN" }
    : { available: true, slug: validation.slug };
}
