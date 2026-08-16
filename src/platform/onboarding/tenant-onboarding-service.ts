import type { Prisma } from "@prisma/client";

import { normalizeWorkingDays } from "@/lib/club-working-days";
import { prisma } from "@/lib/prisma";
import {
  ACTIVITY_TEMPLATES,
  ACTIVITY_TEMPLATE_CATALOG_VERSION,
  activityTemplatesForEdition,
  resolveActivityTemplateKeys,
} from "@/platform/onboarding/activity-templates";
import { missingRequiredOnboardingStep } from "@/platform/onboarding/onboarding-readiness";
import type { OnboardingMutation } from "@/platform/onboarding/onboarding-schemas";
import { getTenantProductContext } from "@/platform/product/product-context";

export class TenantOnboardingError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "TenantOnboardingError";
  }
}

type OnboardingTransaction = Prisma.TransactionClient;

function editionForProfile(profile: "CLASS_ONLY" | "GYM_ONLY" | "HYBRID") {
  if (profile === "CLASS_ONLY") return "CLASS" as const;
  if (profile === "GYM_ONLY") return "GYM" as const;
  return "HYBRID" as const;
}

function acknowledged(current: string[], step: string): string[] {
  return Array.from(new Set([...current, step]));
}

async function requireOnboarding(tenantId: string, tx: OnboardingTransaction | typeof prisma = prisma) {
  const onboarding = await tx.tenantOnboarding.findUnique({
    where: { tenantId },
  });
  if (!onboarding) throw new TenantOnboardingError("Aucun parcours de démarrage n'est actif.", 404);
  return onboarding;
}

export async function getTenantOnboardingState(tenantId: string) {
  const product = await getTenantProductContext(tenantId);
  const edition = editionForProfile(product.profile);
  const [onboarding, settings, sports] = await Promise.all([
    requireOnboarding(tenantId),
    prisma.clubSettings.findUnique({
      where: { tenantId },
      select: {
        clubName: true,
        clubPhone: true,
        clubAddress: true,
        workingDays: true,
        allowCheckInWithPartialPayment: true,
        absentConsumesSession: true,
        gymAllowCheckInWithPartialPayment: true,
        gymAllowExceptionalAccess: true,
      },
    }),
    product.capabilities.classManagement
      ? prisma.sport.findMany({
          where: { tenantId, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);
  if (!settings) throw new TenantOnboardingError("Les réglages du club sont introuvables.", 404);

  const selectedTemplates = resolveActivityTemplateKeys(onboarding.selectedTemplateKeys, edition);
  const suggestedDisciplines = Array.from(new Set(
    selectedTemplates.flatMap((key) =>
      ACTIVITY_TEMPLATES.find((template) => template.key === key)?.suggestedDisciplines ?? [],
    ),
  ));

  return {
    status: onboarding.status,
    source: onboarding.source,
    lastStepKey: onboarding.lastStepKey,
    acknowledgedStepKeys: onboarding.acknowledgedStepKeys,
    selectedTemplateKeys: selectedTemplates,
    selectedDisciplineNames: onboarding.selectedDisciplineNames.length > 0
      ? onboarding.selectedDisciplineNames
      : suggestedDisciplines,
    suggestedDisciplines,
    templates: activityTemplatesForEdition(edition).map((template) => ({
      ...template,
      editions: [...template.editions],
      suggestedDisciplines: [...template.suggestedDisciplines],
      suggestedPlanTemplates: [...template.suggestedPlanTemplates],
      keywords: [...template.keywords],
    })),
    profile: product.profile,
    modules: product.modules,
    club: {
      name: settings.clubName,
      phone: settings.clubPhone,
      address: settings.clubAddress,
      workingDays: settings.workingDays,
    },
    policies: {
      allowCheckInWithPartialPayment: settings.allowCheckInWithPartialPayment,
      absentConsumesSession: settings.absentConsumesSession,
      gymAllowCheckInWithPartialPayment: settings.gymAllowCheckInWithPartialPayment,
      gymAllowExceptionalAccess: settings.gymAllowExceptionalAccess,
    },
    existingDisciplines: sports,
  };
}

async function saveProfile(tenantId: string, actorId: string, input: Extract<OnboardingMutation, { action: "PROFILE" }>) {
  await prisma.$transaction(async (tx) => {
    const onboarding = await requireOnboarding(tenantId, tx);
    if (onboarding.status === "COMPLETED") return;
    const settings = await tx.clubSettings.findUnique({ where: { tenantId } });
    if (!settings) throw new TenantOnboardingError("Les réglages du club sont introuvables.", 404);
    const workingDays = normalizeWorkingDays(input.workingDays);

    await tx.tenant.update({ where: { id: tenantId }, data: { name: input.clubName } });
    await tx.clubSettings.update({
      where: { tenantId },
      data: {
        clubName: input.clubName,
        clubPhone: input.clubPhone,
        clubAddress: input.clubAddress,
        workingDays,
      },
    });
    await tx.tenantOnboarding.update({
      where: { tenantId },
      data: {
        lastStepKey: "activities",
        acknowledgedStepKeys: acknowledged(onboarding.acknowledgedStepKeys, "club-profile"),
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        action: "ONBOARDING_PROFILE_SAVED",
        entityType: "TenantOnboarding",
        entityId: onboarding.id,
        userId: actorId,
        details: JSON.stringify({
          before: { clubName: settings.clubName, clubPhone: settings.clubPhone, clubAddress: settings.clubAddress, workingDays: settings.workingDays },
          after: { clubName: input.clubName, clubPhone: input.clubPhone, clubAddress: input.clubAddress, workingDays },
        }),
      },
    });
  });
}

async function saveActivities(tenantId: string, actorId: string, input: Extract<OnboardingMutation, { action: "ACTIVITIES" }>) {
  const product = await getTenantProductContext(tenantId);
  const edition = editionForProfile(product.profile);
  const templateKeys = resolveActivityTemplateKeys(input.templateKeys, edition);
  if (templateKeys.length !== input.templateKeys.length) {
    throw new TenantOnboardingError("Une activité choisie ne correspond pas aux modules du club.");
  }
  if (product.capabilities.classManagement && input.disciplineNames.length === 0) {
    throw new TenantOnboardingError("Choisissez au moins une discipline pour organiser vos cours.");
  }
  if (!product.capabilities.classManagement && input.disciplineNames.length > 0) {
    throw new TenantOnboardingError("Une salle sans cours n'a pas besoin de disciplines.");
  }

  await prisma.$transaction(async (tx) => {
    const onboarding = await requireOnboarding(tenantId, tx);
    if (onboarding.status === "COMPLETED") return;
    await tx.tenantOnboarding.update({
      where: { tenantId },
      data: {
        selectedTemplateKeys: templateKeys,
        selectedDisciplineNames: input.disciplineNames,
        templateCatalogVersion: ACTIVITY_TEMPLATE_CATALOG_VERSION,
        lastStepKey: "policies",
        acknowledgedStepKeys: acknowledged(onboarding.acknowledgedStepKeys, "activities"),
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        action: "ONBOARDING_ACTIVITIES_SAVED",
        entityType: "TenantOnboarding",
        entityId: onboarding.id,
        userId: actorId,
        details: JSON.stringify({
          before: {
            templateKeys: onboarding.selectedTemplateKeys,
            disciplineNames: onboarding.selectedDisciplineNames,
          },
          after: { templateKeys, disciplineNames: input.disciplineNames },
        }),
      },
    });
  });
}

async function savePolicies(tenantId: string, actorId: string, input: Extract<OnboardingMutation, { action: "POLICIES" }>) {
  const product = await getTenantProductContext(tenantId);
  await prisma.$transaction(async (tx) => {
    const onboarding = await requireOnboarding(tenantId, tx);
    if (onboarding.status === "COMPLETED") return;
    const settings = await tx.clubSettings.findUnique({
      where: { tenantId },
      select: {
        allowCheckInWithPartialPayment: true,
        absentConsumesSession: true,
        gymAllowCheckInWithPartialPayment: true,
        gymAllowExceptionalAccess: true,
      },
    });
    if (!settings) throw new TenantOnboardingError("Les réglages du club sont introuvables.", 404);
    const settingsPatch = {
      ...(product.capabilities.classManagement ? {
        allowCheckInWithPartialPayment: input.allowCheckInWithPartialPayment,
        absentConsumesSession: input.absentConsumesSession,
      } : {}),
      ...(product.capabilities.gymAccess ? {
        gymAllowCheckInWithPartialPayment: input.gymAllowCheckInWithPartialPayment,
        gymAllowExceptionalAccess: input.gymAllowExceptionalAccess,
      } : {}),
    };
    await tx.clubSettings.update({ where: { tenantId }, data: settingsPatch });
    await tx.tenantOnboarding.update({
      where: { tenantId },
      data: {
        lastStepKey: "review",
        acknowledgedStepKeys: acknowledged(onboarding.acknowledgedStepKeys, "policies"),
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        action: "ONBOARDING_POLICIES_SAVED",
        entityType: "TenantOnboarding",
        entityId: onboarding.id,
        userId: actorId,
        details: JSON.stringify({ before: settings, after: settingsPatch }),
      },
    });
  });
}

async function completeOnboarding(tenantId: string, actorId: string) {
  const product = await getTenantProductContext(tenantId);
  await prisma.$transaction(async (tx) => {
    const onboarding = await requireOnboarding(tenantId, tx);
    if (onboarding.status === "COMPLETED") return;
    const settings = await tx.clubSettings.findUnique({ where: { tenantId }, select: { clubName: true } });
    if (!settings?.clubName.trim()) throw new TenantOnboardingError("Complétez d'abord l'identité du club.");
    if (missingRequiredOnboardingStep(onboarding.acknowledgedStepKeys)) {
      throw new TenantOnboardingError("Terminez chaque étape avant d’ouvrir votre espace.");
    }
    if (product.capabilities.classManagement && onboarding.selectedDisciplineNames.length === 0) {
      throw new TenantOnboardingError("Choisissez au moins une discipline avant de terminer.");
    }

    let createdDisciplines = 0;
    if (product.capabilities.classManagement) {
      const existing = await tx.sport.findMany({ where: { tenantId }, select: { name: true } });
      const existingNames = new Set(existing.map((sport) => sport.name.toLocaleLowerCase("fr")));
      const namesToCreate = onboarding.selectedDisciplineNames.filter(
        (name) => !existingNames.has(name.toLocaleLowerCase("fr")),
      );
      if (namesToCreate.length > 0) {
        const result = await tx.sport.createMany({
          data: namesToCreate.map((name) => ({ tenantId, name })),
          skipDuplicates: true,
        });
        createdDisciplines = result.count;
      }
    }

    const completedAt = new Date();
    await tx.tenantOnboarding.update({
      where: { tenantId },
      data: {
        status: "COMPLETED",
        completedAt,
        lastStepKey: "completed",
        acknowledgedStepKeys: acknowledged(onboarding.acknowledgedStepKeys, "review"),
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        action: "ONBOARDING_COMPLETED",
        entityType: "TenantOnboarding",
        entityId: onboarding.id,
        userId: actorId,
        details: JSON.stringify({
          profile: product.profile,
          modules: product.modules,
          templateKeys: onboarding.selectedTemplateKeys,
          disciplineNames: onboarding.selectedDisciplineNames,
          createdDisciplines,
          completedAt: completedAt.toISOString(),
        }),
      },
    });
  });
}

export async function mutateTenantOnboarding(tenantId: string, actorId: string, input: OnboardingMutation) {
  if (input.action === "PROFILE") await saveProfile(tenantId, actorId, input);
  if (input.action === "ACTIVITIES") await saveActivities(tenantId, actorId, input);
  if (input.action === "POLICIES") await savePolicies(tenantId, actorId, input);
  if (input.action === "COMPLETE") await completeOnboarding(tenantId, actorId);
  return getTenantOnboardingState(tenantId);
}
