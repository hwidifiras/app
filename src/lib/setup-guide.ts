import { prisma } from "@/lib/prisma";
import { getRequiredTenantId } from "@/lib/tenant-context";

export type SetupGuideStepId = "sport" | "coach" | "group" | "plan" | "member";

export type SetupGuideStep = {
  id: SetupGuideStepId;
  order: number;
  label: string;
  shortLabel: string;
  description: string;
  href: string;
};

export const SETUP_GUIDE_STEPS: SetupGuideStep[] = [
  {
    id: "sport",
    order: 1,
    label: "Créer une discipline",
    shortLabel: "Discipline",
    description: "Ajoutez au moins une discipline (karaté, BJJ, etc.).",
    href: "/sports",
  },
  {
    id: "coach",
    order: 2,
    label: "Ajouter un coach",
    shortLabel: "Coach",
    description: "Renseignez les coachs qui animent les cours.",
    href: "/coaches",
  },
  {
    id: "group",
    order: 3,
    label: "Créer un cours",
    shortLabel: "Cours",
    description: "Créez un groupe avec créneaux et capacité.",
    href: "/groups/new",
  },
  {
    id: "plan",
    order: 4,
    label: "Définir une formule",
    shortLabel: "Formule",
    description: "Tarifs, séances et validité des abonnements.",
    href: "/subscription-plans/new",
  },
  {
    id: "member",
    order: 5,
    label: "Créer un élève",
    shortLabel: "Élève",
    description: "Premier membre pour tester inscription et pointage.",
    href: "/members/new",
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
};

export async function getSetupGuideProgress(options: { tenantId?: string } = {}): Promise<SetupGuideProgress> {
  const tenantId = options.tenantId ?? getRequiredTenantId();
  const [sportCount, coachCount, groupCount, planCount, memberCount] = await Promise.all([
    prisma.sport.count({ where: { tenantId } }),
    prisma.coach.count({ where: { tenantId } }),
    prisma.group.count({ where: { tenantId } }),
    prisma.subscriptionPlan.count({ where: { tenantId } }),
    prisma.member.count({ where: { tenantId } }),
  ]);

  const doneById: Record<SetupGuideStepId, boolean> = {
    sport: sportCount > 0,
    coach: coachCount > 0,
    group: groupCount > 0,
    plan: planCount > 0,
    member: memberCount > 0,
  };

  const steps = SETUP_GUIDE_STEPS.map((step) => ({
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
  };
}
