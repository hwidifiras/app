import { describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { withTenantContext } from "@/lib/tenant-context";
import {
  getTenantOnboardingState,
  mutateTenantOnboarding,
  TenantOnboardingError,
} from "@/platform/onboarding/tenant-onboarding-service";
import { TEST_TENANT_ID, TEST_TENANT_SLUG } from "./setup";

describe("self-serve tenant onboarding", () => {
  it("configures a hybrid workspace without creating fake business data", async () => {
    await withTenantContext(
      { tenantId: TEST_TENANT_ID, tenantSlug: TEST_TENANT_SLUG, host: "test.local" },
      async () => {
        const actor = await prisma.user.create({
          data: {
            tenantId: TEST_TENANT_ID,
            email: "onboarding-owner@example.test",
            name: "Owner onboarding",
            passwordHash: "test",
            role: "ADMIN",
          },
        });
        await prisma.tenantModule.upsert({
          where: { tenantId_moduleKey: { tenantId: TEST_TENANT_ID, moduleKey: "GYM_ACCESS" } },
          create: {
            tenantId: TEST_TENANT_ID,
            moduleKey: "GYM_ACCESS",
            status: "ENABLED",
            enabledAt: new Date(),
          },
          update: { status: "ENABLED", enabledAt: new Date(), disabledAt: null },
        });
        await prisma.tenantOnboarding.create({
          data: {
            tenantId: TEST_TENANT_ID,
            source: "SELF_SERVE",
            status: "IN_PROGRESS",
            lastStepKey: "club-profile",
            selectedTemplateKeys: ["martial-arts-and-gym"],
          },
        });

        const initial = await getTenantOnboardingState(TEST_TENANT_ID);
        expect(initial.profile).toBe("HYBRID");
        expect(initial.modules).toEqual(["CLASS_MANAGEMENT", "GYM_ACCESS"]);

        await expect(mutateTenantOnboarding(TEST_TENANT_ID, actor.id, { action: "COMPLETE" }))
          .rejects.toBeInstanceOf(TenantOnboardingError);

        await mutateTenantOnboarding(TEST_TENANT_ID, actor.id, {
          action: "PROFILE",
          clubName: "Club Hybride Tunis",
          clubPhone: "+216 20 000 000",
          clubAddress: "Tunis",
          workingDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"],
        });
        await mutateTenantOnboarding(TEST_TENANT_ID, actor.id, {
          action: "ACTIVITIES",
          templateKeys: ["martial-arts-and-gym"],
          disciplineNames: ["Kick boxing", "Jiu-jitsu brésilien"],
        });
        await mutateTenantOnboarding(TEST_TENANT_ID, actor.id, {
          action: "POLICIES",
          allowCheckInWithPartialPayment: true,
          absentConsumesSession: false,
          gymAllowCheckInWithPartialPayment: true,
          gymAllowExceptionalAccess: true,
        });
        const completed = await mutateTenantOnboarding(TEST_TENANT_ID, actor.id, { action: "COMPLETE" });

        expect(completed.status).toBe("COMPLETED");
        expect(completed.club.name).toBe("Club Hybride Tunis");
        expect(completed.policies).toMatchObject({
          allowCheckInWithPartialPayment: true,
          absentConsumesSession: false,
          gymAllowCheckInWithPartialPayment: true,
          gymAllowExceptionalAccess: true,
        });

        const [sports, members, plans, payments, auditLogs] = await Promise.all([
          prisma.sport.findMany({ where: { tenantId: TEST_TENANT_ID }, orderBy: { name: "asc" } }),
          prisma.member.count({ where: { tenantId: TEST_TENANT_ID } }),
          prisma.subscriptionPlan.count({ where: { tenantId: TEST_TENANT_ID } }),
          prisma.payment.count({ where: { tenantId: TEST_TENANT_ID } }),
          prisma.auditLog.findMany({
            where: { tenantId: TEST_TENANT_ID, entityType: "TenantOnboarding" },
            orderBy: { createdAt: "asc" },
          }),
        ]);

        expect(sports.map((sport) => sport.name)).toEqual(["Jiu-jitsu brésilien", "Kick boxing"]);
        expect({ members, plans, payments }).toEqual({ members: 0, plans: 0, payments: 0 });
        expect(auditLogs.map((log) => log.action)).toEqual([
          "ONBOARDING_PROFILE_SAVED",
          "ONBOARDING_ACTIVITIES_SAVED",
          "ONBOARDING_POLICIES_SAVED",
          "ONBOARDING_COMPLETED",
        ]);
        expect(auditLogs.every((log) => log.userId === actor.id)).toBe(true);
      },
    );
  }, 30_000);

  it("finishes a gym-only workspace without class records", async () => {
    const tenantId = "tenant_onboarding_gym";
    const tenantSlug = "onboarding-gym";
    await prisma.tenant.create({
      data: { id: tenantId, slug: tenantSlug, name: "Gym onboarding" },
    });

    await withTenantContext(
      { tenantId, tenantSlug, host: `${tenantSlug}.test` },
      async () => {
        await prisma.clubSettings.create({ data: { tenantId, clubName: "Gym onboarding" } });
        await prisma.tenantModule.create({
          data: {
            tenantId,
            moduleKey: "GYM_ACCESS",
            status: "ENABLED",
            enabledAt: new Date(),
          },
        });
        const actor = await prisma.user.create({
          data: {
            tenantId,
            email: "gym-onboarding@example.test",
            name: "Owner gym",
            passwordHash: "test",
            role: "ADMIN",
          },
        });
        await prisma.tenantOnboarding.create({
          data: {
            tenantId,
            source: "SELF_SERVE",
            status: "IN_PROGRESS",
            lastStepKey: "club-profile",
            selectedTemplateKeys: ["fitness-gym"],
          },
        });

        const initial = await getTenantOnboardingState(tenantId);
        expect(initial.profile).toBe("GYM_ONLY");
        expect(initial.selectedDisciplineNames).toEqual([]);

        await mutateTenantOnboarding(tenantId, actor.id, {
          action: "PROFILE",
          clubName: "Gym Tunis",
          clubPhone: "",
          clubAddress: "Tunis",
          workingDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
        });
        await mutateTenantOnboarding(tenantId, actor.id, {
          action: "ACTIVITIES",
          templateKeys: ["fitness-gym"],
          disciplineNames: [],
        });
        await mutateTenantOnboarding(tenantId, actor.id, {
          action: "POLICIES",
          allowCheckInWithPartialPayment: false,
          absentConsumesSession: true,
          gymAllowCheckInWithPartialPayment: true,
          gymAllowExceptionalAccess: false,
        });
        const completed = await mutateTenantOnboarding(tenantId, actor.id, { action: "COMPLETE" });

        expect(completed.status).toBe("COMPLETED");
        expect(await prisma.sport.count({ where: { tenantId } })).toBe(0);
        expect(await prisma.coach.count({ where: { tenantId } })).toBe(0);
        expect(await prisma.group.count({ where: { tenantId } })).toBe(0);
        expect(await prisma.session.count({ where: { tenantId } })).toBe(0);
        expect(await prisma.subscriptionPlan.count({ where: { tenantId } })).toBe(0);
      },
    );
  }, 30_000);
});
