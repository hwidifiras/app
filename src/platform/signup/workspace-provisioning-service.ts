import { randomUUID } from "node:crypto";

import { Prisma, type TenantModuleKey, type WorkspaceEdition } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { runSerializableTransaction } from "@/lib/serializable-transaction";
import { withTenantContext } from "@/lib/tenant-context";
import { productModulesForEdition, saasPlanCodeForEdition } from "@/platform/billing/edition-plan";
import {
  ACTIVITY_TEMPLATE_CATALOG_VERSION,
  resolveActivityTemplateKeys,
} from "@/platform/onboarding/activity-templates";
import { resolveSaasSignupConfig } from "@/platform/signup/signup-config";
import { SignupServiceError } from "@/platform/signup/signup-errors";
import type { SignupProvisionInput } from "@/platform/signup/signup-schemas";
import { createWorkspaceHandoffSecret } from "@/platform/signup/signup-security";
import {
  issueWorkspaceHandoffToken,
  type WorkspaceHandoff,
} from "@/platform/signup/workspace-handoff-service";
import {
  validateWorkspaceSlug,
  workspaceHostForSlug,
  workspaceUrlForSlug,
} from "@/platform/signup/workspace-slug";

const ALL_MODULES: readonly TenantModuleKey[] = ["CLASS_MANAGEMENT", "GYM_ACCESS"];

function sameModuleSet(left: readonly TenantModuleKey[], right: readonly TenantModuleKey[]): boolean {
  return left.length === right.length && left.every((key) => right.includes(key));
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function handoffForCompletedSignup(signup: {
  tenantId: string | null;
  adminUserId: string | null;
  email: string;
  tenant: { slug: string } | null;
}): Promise<WorkspaceHandoff> {
  if (!signup.tenantId || !signup.adminUserId || !signup.tenant) {
    throw new SignupServiceError("PROVISIONING_FAILED", 500);
  }
  return issueWorkspaceHandoffToken({
    tenantId: signup.tenantId,
    tenantSlug: signup.tenant.slug,
    userId: signup.adminUserId,
    operatorIdentity: `self-serve:${signup.email}`,
  });
}

async function currentTrialEnd(tenantId: string, tenantSlug: string): Promise<Date> {
  return withTenantContext({ tenantId, tenantSlug }, async () => {
    const subscription = await prisma.tenantSaasSubscription.findFirst({
      where: { tenantId, isCurrent: true },
      select: { trialEndsAt: true },
    });
    return subscription?.trialEndsAt ?? new Date();
  });
}

function handoffPayload(tenantSlug: string, userId: string, token: string): WorkspaceHandoff {
  const workspaceUrl = workspaceUrlForSlug(tenantSlug);
  return {
    workspaceUrl,
    actionUrl: new URL("/api/auth/handoff", workspaceUrl).toString(),
    userId,
    token,
  };
}

export async function resumeCompletedWorkspace(signupId: string): Promise<{
  tenantId: string;
  tenantSlug: string;
  handoff: WorkspaceHandoff;
  trialEndsAt: Date;
}> {
  const signup = await prisma.workspaceSignup.findUnique({
    where: { id: signupId },
    select: {
      status: true,
      tenantId: true,
      adminUserId: true,
      email: true,
      tenant: { select: { slug: true } },
    },
  });
  if (!signup) throw new SignupServiceError("SIGNUP_SESSION_INVALID", 401);
  if (signup.status !== "COMPLETED") throw new SignupServiceError("SIGNUP_NOT_VERIFIED", 403);
  const handoff = await handoffForCompletedSignup(signup);
  const tenantId = signup.tenantId as string;
  const tenantSlug = signup.tenant?.slug as string;
  return {
    tenantId,
    tenantSlug,
    handoff,
    trialEndsAt: await currentTrialEnd(tenantId, tenantSlug),
  };
}

export async function provisionWorkspace(input: {
  signupId: string;
  data: SignupProvisionInput;
}): Promise<{
  tenantId: string;
  tenantSlug: string;
  handoff: WorkspaceHandoff;
  trialEndsAt: Date;
}> {
  const config = resolveSaasSignupConfig();
  if (config.mode === "DISABLED") throw new SignupServiceError("SIGNUP_DISABLED", 404);

  const signup = await prisma.workspaceSignup.findUnique({
    where: { id: input.signupId },
    select: {
      id: true,
      email: true,
      ownerName: true,
      passwordHash: true,
      status: true,
      emailVerifiedAt: true,
      expiresAt: true,
      tenantId: true,
      adminUserId: true,
      inviteId: true,
      tenant: { select: { slug: true } },
      invite: {
        select: {
          email: true,
          edition: true,
          activityTemplateKeys: true,
          expiresAt: true,
          revokedAt: true,
          useCount: true,
          maxUses: true,
        },
      },
    },
  });
  if (!signup) throw new SignupServiceError("SIGNUP_SESSION_INVALID", 401);
  if (signup.status === "COMPLETED") {
    return resumeCompletedWorkspace(signup.id);
  }
  const now = new Date();
  if (signup.expiresAt <= now || signup.status === "EXPIRED") {
    throw new SignupServiceError("SIGNUP_EXPIRED", 400);
  }
  if (signup.status !== "VERIFIED" || !signup.emailVerifiedAt) {
    throw new SignupServiceError("SIGNUP_NOT_VERIFIED", 403);
  }
  if (config.mode === "INVITE_ONLY" && !signup.inviteId) {
    throw new SignupServiceError("SIGNUP_INVITE_INVALID", 403);
  }

  const slugValidation = validateWorkspaceSlug(input.data.slug);
  if (!slugValidation.valid) throw new SignupServiceError("SLUG_INVALID", 400);
  const tenantSlug = slugValidation.slug;
  const workspaceHost = workspaceHostForSlug(tenantSlug);
  const edition = input.data.edition as WorkspaceEdition;
  if (signup.invite?.edition && signup.invite.edition !== edition) {
    throw new SignupServiceError("EDITION_NOT_ALLOWED", 403);
  }

  const requestedTemplateKeys = input.data.activityTemplateKeys.length > 0
    ? input.data.activityTemplateKeys
    : signup.invite?.activityTemplateKeys ?? [];
  const templateKeys = resolveActivityTemplateKeys(requestedTemplateKeys, edition);
  if (templateKeys.length !== new Set(requestedTemplateKeys).size) {
    throw new SignupServiceError("ACTIVITY_TEMPLATE_INVALID", 400);
  }

  const expectedModules = productModulesForEdition(edition);
  const plan = await prisma.saasPlan.findUnique({
    where: { code: saasPlanCodeForEdition(edition) },
    select: {
      id: true,
      isActive: true,
      modules: { select: { moduleKey: true } },
    },
  });
  if (!plan?.isActive) throw new SignupServiceError("SAAS_PLAN_UNAVAILABLE", 503);
  const configuredModules = plan.modules.map((entry) => entry.moduleKey);
  if (!sameModuleSet(configuredModules, expectedModules)) {
    throw new SignupServiceError("SAAS_PLAN_CONFIGURATION_INVALID", 503);
  }

  const tenantId = randomUUID();
  const adminUserId = randomUUID();
  const saasSubscriptionId = randomUUID();
  const trialEndsAt = new Date(now.getTime() + config.trialDays * 24 * 60 * 60 * 1_000);
  let provisionedHandoffToken = "";
  try {
    provisionedHandoffToken = await withTenantContext(
      { tenantId, tenantSlug },
      () => runSerializableTransaction(async (tx) => {
      const claimed = await tx.workspaceSignup.updateMany({
        where: {
          id: signup.id,
          status: "VERIFIED",
          tenantId: null,
          adminUserId: null,
        },
        data: {
          status: "PROVISIONING",
          provisioningStartedAt: now,
          failureCode: null,
        },
      });
      if (claimed.count !== 1) throw new SignupServiceError("SIGNUP_ALREADY_COMPLETED", 409);

      if (signup.inviteId) {
        const invite = signup.invite;
        if (
          !invite
          || invite.revokedAt
          || invite.expiresAt <= now
          || invite.useCount >= invite.maxUses
          || (invite.email !== null && invite.email !== signup.email)
        ) {
          throw new SignupServiceError("SIGNUP_INVITE_INVALID", 403);
        }
        const inviteClaim = await tx.workspaceSignupInvite.updateMany({
          where: {
            id: signup.inviteId,
            revokedAt: null,
            expiresAt: { gt: now },
            useCount: { lt: invite.maxUses },
          },
          data: { useCount: { increment: 1 } },
        });
        if (inviteClaim.count !== 1) throw new SignupServiceError("SIGNUP_INVITE_INVALID", 403);
      }

      const occupiedWorkspace = await tx.tenant.findFirst({
        where: {
          OR: [
            { slug: tenantSlug },
            { rootDomainAlias: workspaceHost },
          ],
        },
        select: { id: true },
      });
      if (occupiedWorkspace) throw new SignupServiceError("SLUG_UNAVAILABLE", 409);

      await tx.tenant.create({
        data: {
          id: tenantId,
          slug: tenantSlug,
          name: input.data.clubName.trim(),
          status: "ACTIVE",
        },
      });
      await tx.clubSettings.create({
        data: {
          tenantId,
          clubName: input.data.clubName.trim(),
          clubPhone: input.data.clubPhone.trim(),
          clubAddress: input.data.clubAddress.trim(),
        },
      });
      await tx.user.create({
        data: {
          id: adminUserId,
          tenantId,
          email: signup.email,
          name: signup.ownerName,
          passwordHash: signup.passwordHash,
          role: "ADMIN",
          isActive: true,
        },
      });
      await tx.tenantSaasSubscription.create({
        data: {
          id: saasSubscriptionId,
          tenantId,
          saasPlanId: plan.id,
          status: "TRIAL",
          isCurrent: true,
          startsAt: now,
          trialEndsAt,
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
          operatorNote: "Essai cree par inscription libre-service",
        },
      });
      await tx.tenantModule.createMany({
        data: ALL_MODULES.map((moduleKey) => {
          const enabled = expectedModules.includes(moduleKey);
          return {
            tenantId,
            moduleKey,
            status: enabled ? "ENABLED" as const : "DISABLED" as const,
            grantSource: "SAAS_SUBSCRIPTION" as const,
            saasSubscriptionId,
            enabledAt: enabled ? now : null,
            disabledAt: enabled ? null : now,
          };
        }),
      });
      await tx.tenantOnboarding.create({
        data: {
          tenantId,
          source: "SELF_SERVE",
          status: "IN_PROGRESS",
          lastStepKey: "club-profile",
          selectedTemplateKeys: templateKeys,
          templateCatalogVersion: ACTIVITY_TEMPLATE_CATALOG_VERSION,
        },
      });

      const handoffSecret = createWorkspaceHandoffSecret(tenantId, adminUserId);
      await tx.workspaceHandoffToken.create({
        data: {
          tenantId,
          userId: adminUserId,
          tokenHash: handoffSecret.tokenHash,
          expiresAt: new Date(now.getTime() + 10 * 60 * 1_000),
        },
      });
      await tx.workspaceSignup.update({
        where: { id: signup.id },
        data: {
          clubName: input.data.clubName.trim(),
          clubPhone: input.data.clubPhone.trim(),
          clubAddress: input.data.clubAddress.trim(),
          requestedSlug: tenantSlug,
          edition,
          activityTemplateKeys: templateKeys,
          templateCatalogVersion: ACTIVITY_TEMPLATE_CATALOG_VERSION,
          status: "COMPLETED",
          tenantId,
          adminUserId,
          completedAt: now,
          failureCode: null,
        },
      });
      await tx.platformAuditLog.create({
        data: {
          tenantId,
          action: "SELF_SERVE_WORKSPACE_PROVISIONED",
          entityType: "Tenant",
          entityId: tenantId,
          operatorIdentity: `self-serve:${signup.email}`,
          afterState: {
            tenantSlug,
            edition,
            modules: expectedModules,
            planCode: saasPlanCodeForEdition(edition),
            trialEndsAt: trialEndsAt.toISOString(),
            templateKeys,
          },
        },
      });
      await tx.platformAuditLog.create({
        data: {
          tenantId,
          action: "WORKSPACE_HANDOFF_ISSUED",
          entityType: "User",
          entityId: adminUserId,
          operatorIdentity: `self-serve:${signup.email}`,
          metadata: { expiresInSeconds: 600 },
        },
      });

      return handoffSecret.token;
      }),
    );
  } catch (error) {
    if (error instanceof SignupServiceError && error.code === "SIGNUP_ALREADY_COMPLETED") {
      const completed = await prisma.workspaceSignup.findUnique({
        where: { id: signup.id },
        select: {
          tenantId: true,
          adminUserId: true,
          email: true,
          tenant: { select: { slug: true } },
        },
      });
      if (completed?.tenantId && completed.adminUserId && completed.tenant) {
        const handoff = await handoffForCompletedSignup(completed);
        return {
          tenantId: completed.tenantId,
          tenantSlug: completed.tenant.slug,
          handoff,
          trialEndsAt: await currentTrialEnd(completed.tenantId, completed.tenant.slug),
        };
      }
    }
    if (error instanceof SignupServiceError) throw error;
    if (isUniqueConstraintError(error)) throw new SignupServiceError("SLUG_UNAVAILABLE", 409);
    throw new SignupServiceError("PROVISIONING_FAILED", 500);
  }

  return {
    tenantId,
    tenantSlug,
    handoff: handoffPayload(tenantSlug, adminUserId, provisionedHandoffToken),
    trialEndsAt,
  };
}
