import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { withTenantContext } from "@/lib/tenant-context";
import {
  getWorkspaceSignupState,
  startWorkspaceSignup,
  verifyWorkspaceSignup,
} from "@/platform/signup/signup-account-service";
import { claimWorkspaceHandoff } from "@/platform/signup/workspace-handoff-service";
import { provisionWorkspace } from "@/platform/signup/workspace-provisioning-service";

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const primaryEmail = `owner-${suffix}@example.test`;
const rollbackEmail = `rollback-${suffix}@example.test`;
const tenantSlug = `signup-${suffix}`.slice(0, 48).replace(/-+$/g, "");
const signupIds: string[] = [];
const tenantIds: string[] = [];

const previousEnvironment = {
  signupMode: process.env.SAAS_SIGNUP_MODE,
  signupSecret: process.env.SIGNUP_TOKEN_SECRET,
  platformUrl: process.env.PLATFORM_APP_URL,
  rootDomain: process.env.SAAS_ROOT_DOMAIN,
  trialDays: process.env.SAAS_SIGNUP_TRIAL_DAYS,
  trialGraceDays: process.env.SAAS_SIGNUP_TRIAL_GRACE_DAYS,
  resendApiKey: process.env.RESEND_API_KEY,
  signupFrom: process.env.SAAS_SIGNUP_FROM,
};

async function seedEditionPlans() {
  const specs = [
    { code: "CLASS", name: "Classes", modules: ["CLASS_MANAGEMENT"] as const },
    { code: "GYM", name: "Gym", modules: ["GYM_ACCESS"] as const },
    { code: "HYBRID", name: "Hybride", modules: ["CLASS_MANAGEMENT", "GYM_ACCESS"] as const },
  ];
  for (const spec of specs) {
    const plan = await prisma.saasPlan.upsert({
      where: { code: spec.code },
      create: { code: spec.code, name: spec.name, isActive: true },
      update: { isActive: true },
    });
    await prisma.saasPlanModule.deleteMany({ where: { saasPlanId: plan.id } });
    await prisma.saasPlanModule.createMany({
      data: spec.modules.map((moduleKey) => ({ saasPlanId: plan.id, moduleKey })),
    });
  }
}

async function createVerifiedSignup(email: string, key: string) {
  const started = await startWorkspaceSignup({
    data: {
      ownerName: "Owner Test",
      email,
      password: "Motdepasse2026",
      termsAccepted: true,
    },
    clientIp: "127.0.0.1",
    idempotencyKey: key,
  });
  signupIds.push(started.state.signupId);
  const code = started.developmentVerification?.code;
  if (!code) throw new Error("Development verification code missing");
  return { started, code };
}

beforeAll(async () => {
  process.env.SAAS_SIGNUP_MODE = "PUBLIC";
  process.env.SIGNUP_TOKEN_SECRET = "integration-signup-secret-at-least-thirty-two-characters";
  process.env.PLATFORM_APP_URL = "http://app.localhost:3000";
  process.env.SAAS_ROOT_DOMAIN = "localhost";
  process.env.SAAS_SIGNUP_TRIAL_DAYS = "14";
  process.env.SAAS_SIGNUP_TRIAL_GRACE_DAYS = "3";
  delete process.env.RESEND_API_KEY;
  delete process.env.SAAS_SIGNUP_FROM;
  await seedEditionPlans();
});
afterAll(async () => {
  await prisma.workspaceSignup.deleteMany({ where: { id: { in: signupIds } } });
  for (const tenantId of tenantIds) {
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  }

  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };
  restore("SAAS_SIGNUP_MODE", previousEnvironment.signupMode);
  restore("SIGNUP_TOKEN_SECRET", previousEnvironment.signupSecret);
  restore("PLATFORM_APP_URL", previousEnvironment.platformUrl);
  restore("SAAS_ROOT_DOMAIN", previousEnvironment.rootDomain);
  restore("SAAS_SIGNUP_TRIAL_DAYS", previousEnvironment.trialDays);
  restore("SAAS_SIGNUP_TRIAL_GRACE_DAYS", previousEnvironment.trialGraceDays);
  restore("RESEND_API_KEY", previousEnvironment.resendApiKey);
  restore("SAAS_SIGNUP_FROM", previousEnvironment.signupFrom);
});

describe("atomic owner workspace provisioning", () => {
  it("verifies email, creates one class tenant, and redeems a handoff once", async () => {
    const { started, code } = await createVerifiedSignup(primaryEmail, `start-${suffix}`);

    await expect(verifyWorkspaceSignup({
      signupId: started.state.signupId,
      code: "000000" === code ? "111111" : "000000",
    })).rejects.toMatchObject({ code: "SIGNUP_VERIFICATION_INVALID" });
    const tokenAfterFailure = await prisma.signupVerificationToken.findFirstOrThrow({
      where: { signupId: started.state.signupId },
      orderBy: { createdAt: "desc" },
    });
    expect(tokenAfterFailure.attemptCount).toBe(1);

    const verified = await verifyWorkspaceSignup({ signupId: started.state.signupId, code });
    expect(verified.status).toBe("VERIFIED");

    const provisioned = await provisionWorkspace({
      signupId: started.state.signupId,
      data: {
        clubName: "Dojo Signup Test",
        clubPhone: "+21600000000",
        clubAddress: "Tunis",
        slug: tenantSlug,
        edition: "CLASS",
        activityTemplateKeys: ["martial-arts-dojo"],
      },
    });
    tenantIds.push(provisioned.tenantId);
    expect(provisioned.tenantSlug).toBe(tenantSlug);
    expect(provisioned.handoff.actionUrl).toBe(`http://${tenantSlug}.localhost:3000/api/auth/handoff`);

    const tenantState = await withTenantContext(
      { tenantId: provisioned.tenantId, tenantSlug },
      async () => Promise.all([
        prisma.user.findFirstOrThrow({ where: { tenantId: provisioned.tenantId, email: primaryEmail } }),
        prisma.tenantModule.findMany({ where: { tenantId: provisioned.tenantId }, orderBy: { moduleKey: "asc" } }),
        prisma.tenantSaasSubscription.findFirstOrThrow({ where: { tenantId: provisioned.tenantId, isCurrent: true } }),
        prisma.tenantOnboarding.findUniqueOrThrow({ where: { tenantId: provisioned.tenantId } }),
      ]),
    );
    const [admin, modules, subscription, onboarding] = tenantState;
    expect(admin.role).toBe("ADMIN");
    await expect(verifyPassword("Motdepasse2026", admin.passwordHash)).resolves.toBe(true);
    expect(modules.map((module) => [module.moduleKey, module.status])).toEqual([
      ["CLASS_MANAGEMENT", "ENABLED"],
      ["GYM_ACCESS", "DISABLED"],
    ]);
    expect(subscription.status).toBe("TRIAL");
    expect(subscription.automaticLifecycle).toBe(true);
    expect(subscription.trialEndsAt?.getTime()).toBeGreaterThan(Date.now() + 13 * 24 * 60 * 60 * 1_000);
    expect(subscription.graceEndsAt?.getTime()).toBe(
      (subscription.trialEndsAt?.getTime() ?? 0) + 3 * 24 * 60 * 60 * 1_000,
    );
    expect(onboarding).toMatchObject({
      source: "SELF_SERVE",
      status: "IN_PROGRESS",
      selectedTemplateKeys: ["martial-arts-dojo"],
    });
    const completedSignup = await prisma.workspaceSignup.findUniqueOrThrow({
      where: { id: started.state.signupId },
      select: { passwordHash: true, requestFingerprint: true },
    });
    expect(completedSignup).toEqual({ passwordHash: null, requestFingerprint: null });

    const handoffUser = await claimWorkspaceHandoff({
      context: { tenantId: provisioned.tenantId, tenantSlug },
      userId: provisioned.handoff.userId,
      token: provisioned.handoff.token,
    });
    expect(handoffUser).toMatchObject({ tenantId: provisioned.tenantId, email: primaryEmail, role: "ADMIN" });
    await expect(claimWorkspaceHandoff({
      context: { tenantId: provisioned.tenantId, tenantSlug },
      userId: provisioned.handoff.userId,
      token: provisioned.handoff.token,
    })).rejects.toMatchObject({ code: "HANDOFF_INVALID" });

    const retry = await provisionWorkspace({
      signupId: started.state.signupId,
      data: {
        clubName: "Ignored retry",
        clubPhone: "",
        clubAddress: "",
        slug: tenantSlug,
        edition: "CLASS",
        activityTemplateKeys: [],
      },
    });
    expect(retry.tenantId).toBe(provisioned.tenantId);
    expect(await prisma.tenant.count({ where: { slug: tenantSlug } })).toBe(1);
  }, 30_000);

  it("rolls back every tenant-owned row when the workspace address is taken", async () => {
    const { started, code } = await createVerifiedSignup(rollbackEmail, `rollback-${suffix}`);
    await verifyWorkspaceSignup({ signupId: started.state.signupId, code });

    await expect(provisionWorkspace({
      signupId: started.state.signupId,
      data: {
        clubName: "Must Not Exist",
        clubPhone: "",
        clubAddress: "",
        slug: tenantSlug,
        edition: "GYM",
        activityTemplateKeys: ["fitness-gym"],
      },
    })).rejects.toMatchObject({ code: "SLUG_UNAVAILABLE" });

    const state = await getWorkspaceSignupState(started.state.signupId);
    expect(state).toMatchObject({ status: "VERIFIED", tenantId: null });
    expect(await prisma.tenant.count({ where: { name: "Must Not Exist" } })).toBe(0);
  }, 30_000);
});
