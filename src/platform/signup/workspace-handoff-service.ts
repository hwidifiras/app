import type { TenantContext } from "@/lib/tenant-context";

import { runSerializableTransaction } from "@/lib/serializable-transaction";
import { withTenantContext } from "@/lib/tenant-context";
import { SignupServiceError } from "@/platform/signup/signup-errors";
import {
  createWorkspaceHandoffSecret,
  hashWorkspaceHandoffToken,
} from "@/platform/signup/signup-security";
import { workspaceUrlForSlug } from "@/platform/signup/workspace-slug";

const HANDOFF_LIFETIME_MS = 10 * 60 * 1_000;

export type WorkspaceHandoff = {
  actionUrl: string;
  workspaceUrl: string;
  token: string;
  userId: string;
};

export type HandoffUser = {
  id: string;
  tenantId: string;
  tenantSlug: string;
  email: string;
  name: string;
  role: "ADMIN" | "STAFF";
  permissions: string[];
};

export async function issueWorkspaceHandoffToken(input: {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  operatorIdentity: string;
}): Promise<WorkspaceHandoff> {
  const secret = createWorkspaceHandoffSecret(input.tenantId, input.userId);
  const now = new Date();
  await withTenantContext(
    { tenantId: input.tenantId, tenantSlug: input.tenantSlug },
    () => runSerializableTransaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: input.userId, tenantId: input.tenantId, isActive: true },
        select: { id: true },
      });
      if (!user) throw new SignupServiceError("HANDOFF_INVALID", 401);

      await tx.workspaceHandoffToken.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          tokenHash: secret.tokenHash,
          expiresAt: new Date(now.getTime() + HANDOFF_LIFETIME_MS),
        },
      });
      await tx.platformAuditLog.create({
        data: {
          tenantId: input.tenantId,
          action: "WORKSPACE_HANDOFF_ISSUED",
          entityType: "User",
          entityId: input.userId,
          operatorIdentity: input.operatorIdentity,
          metadata: { expiresInSeconds: HANDOFF_LIFETIME_MS / 1_000 },
        },
      });
    }),
  );

  const workspaceUrl = workspaceUrlForSlug(input.tenantSlug);
  return {
    workspaceUrl,
    actionUrl: new URL("/api/auth/handoff", workspaceUrl).toString(),
    token: secret.token,
    userId: input.userId,
  };
}

export async function claimWorkspaceHandoff(input: {
  context: TenantContext;
  userId: string;
  token: string;
}): Promise<HandoffUser> {
  const now = new Date();
  const tokenHash = hashWorkspaceHandoffToken(input.context.tenantId, input.userId, input.token);

  return withTenantContext(input.context, () => runSerializableTransaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: {
        id: input.userId,
        tenantId: input.context.tenantId,
        isActive: true,
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        role: true,
        tenant: { select: { slug: true, status: true } },
        permissions: { select: { key: true } },
      },
    });
    if (!user || !user.tenantId || user.tenant?.status !== "ACTIVE") {
      throw new SignupServiceError("HANDOFF_INVALID", 401);
    }

    const claimed = await tx.workspaceHandoffToken.updateMany({
      where: {
        tenantId: input.context.tenantId,
        userId: input.userId,
        tokenHash,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    if (claimed.count !== 1) throw new SignupServiceError("HANDOFF_INVALID", 401);

    await tx.platformAuditLog.create({
      data: {
        tenantId: input.context.tenantId,
        action: "WORKSPACE_HANDOFF_REDEEMED",
        entityType: "User",
        entityId: user.id,
        operatorIdentity: `self-serve:${user.email}`,
      },
    });

    return {
      id: user.id,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.role === "ADMIN" ? [] : user.permissions.map((permission) => permission.key),
    };
  }));
}
