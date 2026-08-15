import { prisma } from "@/lib/prisma";
import { getRequiredTenantId } from "@/lib/tenant-context";
import {
  getTenantProductContext,
  type ProductModule,
  type ProductProfile,
  type TenantProductContext,
} from "@/platform/product/product-context";

export type SetupGuideStepId = "sport" | "coach" | "group" | "classPlan" | "gymPlan" | "member";

export type SetupGuideStep = {
  id: SetupGuideStepId;
  order: number;
  label: string;
  shortLabel: string;
  description: string;
  href: string;
  module: ProductModule | null;
};

export const SETUP_GUIDE_STEPS: SetupGuideStep[] = [
  {
    id: "sport",
    order: 1,
    label: "Créer une discipline",
    shortLabel: "Discipline",
    description: "Ajoutez au moins une discipline (karaté, BJJ, etc.).",
    href: "/sports",
    module: "CLASS_MANAGEMENT",
  },
  {
    id: "coach",
    order: 2,
    label: "Ajouter un coach",
    shortLabel: "Coach",
    description: "Renseignez les coachs qui animent les cours.",
    href: "/coaches",
    module: "CLASS_MANAGEMENT",
  },
  {
    id: "group",
    order: 3,
    label: "Créer un cours",
    shortLabel: "Cours",
    description: "Créez un groupe avec créneaux et capacité.",
    href: "/groups/new",
    module: "CLASS_MANAGEMENT",
  },
  {
    id: "classPlan",
    order: 4,
    label: "Définir une formule",
    shortLabel: "Formule",
    description: "Tarifs, séances et validité des abonnements.",
    href: "/subscription-plans/new",
    module: "CLASS_MANAGEMENT",
  },
  {
    id: "gymPlan",
    order: 4,
    label: "Définir un pass salle",
    shortLabel: "Pass salle",
    description: "Créez un accès illimité ou un quota de visites.",
    href: "/subscription-plans/new?kind=gym",
    module: "GYM_ACCESS",
  },
  {
    id: "member",
    order: 5,
    label: "Créer un membre",
    shortLabel: "Membre",
    description: "Ajoutez un premier membre pour tester le parcours du club.",
    href: "/members/new",
    module: null,
  },
];

export type SetupGuideStepStatus = SetupGuideStep & {
  done: boolean;
};

export type SetupGuideProgress = {
  steps: SetupGuideStepStatus[];
  completedCount: number;
  totalCount: number;
  pendingCount: number;
  nextStep: SetupGuideStepStatus | null;
  isComplete: boolean;
  profile: ProductProfile;
};

export async function getSetupGuideProgress(options: {
  tenantId?: string;
  productContext?: TenantProductContext;
} = {}): Promise<SetupGuideProgress> {
  const tenantId = options.tenantId ?? getRequiredTenantId();
  const product = options.productContext ?? await getTenantProductContext(tenantId);
  const hasClasses = product.capabilities.classManagement;
  const hasGym = product.capabilities.gymAccess;
  const [sportCount, coachCount, groupCount, classPlanCount, gymPlanCount, memberCount] = await Promise.all([
    hasClasses ? prisma.sport.count({ where: { tenantId } }) : Promise.resolve(0),
    hasClasses ? prisma.coach.count({ where: { tenantId } }) : Promise.resolve(0),
    hasClasses ? prisma.group.count({ where: { tenantId } }) : Promise.resolve(0),
    hasClasses ? prisma.subscriptionPlan.count({ where: { tenantId, planKind: { in: ["CLASS", "MIXED"] } } }) : Promise.resolve(0),
    hasGym ? prisma.subscriptionPlan.count({ where: { tenantId, planKind: { in: ["GYM", "MIXED"] } } }) : Promise.resolve(0),
    prisma.member.count({ where: { tenantId } }),
  ]);

  const doneById: Record<SetupGuideStepId, boolean> = {
    sport: sportCount > 0,
    coach: coachCount > 0,
    group: groupCount > 0,
    classPlan: classPlanCount > 0,
    gymPlan: gymPlanCount > 0,
    member: memberCount > 0,
  };

  const steps = SETUP_GUIDE_STEPS
    .filter((step) => !step.module || product.modules.includes(step.module))
    .map((step) => ({
      ...step,
      done: doneById[step.id],
    }));

  const completedCount = steps.filter((s) => s.done).length;
  const pendingCount = steps.length - completedCount;
  const nextStep = steps.find((s) => !s.done) ?? null;

  return {
    steps,
    completedCount,
    totalCount: steps.length,
    pendingCount,
    nextStep,
    isComplete: pendingCount === 0,
    profile: product.profile,
  };
}
