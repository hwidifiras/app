import type { WorkspaceEdition } from "@prisma/client";

export const ACTIVITY_TEMPLATE_CATALOG_VERSION = 1;

export type ActivityTemplateKey =
  | "martial-arts-dojo"
  | "yoga-wellness-studio"
  | "dance-academy"
  | "group-fitness-studio"
  | "fitness-gym"
  | "martial-arts-and-gym"
  | "classes-and-gym"
  | "custom-class-club"
  | "custom-hybrid-club";

export type ActivityTemplate = {
  key: ActivityTemplateKey;
  label: string;
  description: string;
  editions: readonly WorkspaceEdition[];
  suggestedDisciplines: readonly string[];
  suggestedPlanTemplates: readonly ("CLASS_MONTHLY" | "GYM_UNLIMITED" | "GYM_QUOTA" | "MIXED_MONTHLY")[];
  keywords: readonly string[];
};

export const ACTIVITY_TEMPLATES: readonly ActivityTemplate[] = [
  {
    key: "martial-arts-dojo",
    label: "Dojo / arts martiaux",
    description: "Disciplines, coachs, groupes, planning et pointage des cours.",
    editions: ["CLASS", "HYBRID"],
    suggestedDisciplines: ["Kick boxing", "Boxe", "Judo", "Jiu-jitsu brésilien", "Karaté", "Taekwondo"],
    suggestedPlanTemplates: ["CLASS_MONTHLY"],
    keywords: ["dojo", "combat", "martial", "karate", "boxe", "judo"],
  },
  {
    key: "yoga-wellness-studio",
    label: "Yoga & bien-être",
    description: "Cours récurrents, groupes, intervenants et formules de séances.",
    editions: ["CLASS", "HYBRID"],
    suggestedDisciplines: ["Yoga", "Pilates", "Stretching", "Méditation", "Mobilité"],
    suggestedPlanTemplates: ["CLASS_MONTHLY"],
    keywords: ["yoga", "pilates", "bien-etre", "studio", "mobilite"],
  },
  {
    key: "dance-academy",
    label: "École de danse",
    description: "Cours par style, professeur, niveau, âge et créneau.",
    editions: ["CLASS", "HYBRID"],
    suggestedDisciplines: ["Danse classique", "Hip-hop", "Danse contemporaine", "Salsa", "Danse enfants"],
    suggestedPlanTemplates: ["CLASS_MONTHLY"],
    keywords: ["danse", "academie", "cours", "studio"],
  },
  {
    key: "group-fitness-studio",
    label: "Studio de cours collectifs",
    description: "Fitness, cardio et coaching en groupes planifiés.",
    editions: ["CLASS", "HYBRID"],
    suggestedDisciplines: ["Fitness", "Cross training", "Cardio", "Renforcement", "Cycling"],
    suggestedPlanTemplates: ["CLASS_MONTHLY"],
    keywords: ["fitness", "cross-training", "cardio", "coaching"],
  },
  {
    key: "fitness-gym",
    label: "Salle de sport",
    description: "Pass illimités ou quotas, cartes d'accès et suivi des passages.",
    editions: ["GYM", "HYBRID"],
    suggestedDisciplines: [],
    suggestedPlanTemplates: ["GYM_UNLIMITED", "GYM_QUOTA"],
    keywords: ["gym", "musculation", "fitness", "salle", "acces"],
  },
  {
    key: "martial-arts-and-gym",
    label: "Dojo + salle",
    description: "Cours d'arts martiaux et accès libre réunis dans un même espace membre.",
    editions: ["HYBRID"],
    suggestedDisciplines: ["Kick boxing", "Boxe", "MMA", "Jiu-jitsu brésilien"],
    suggestedPlanTemplates: ["CLASS_MONTHLY", "GYM_UNLIMITED", "MIXED_MONTHLY"],
    keywords: ["hybride", "dojo", "gym", "combat", "musculation"],
  },
  {
    key: "classes-and-gym",
    label: "Cours collectifs + accès libre",
    description: "Un planning de cours et une zone d'accès libre, avec des packs combinés facultatifs.",
    editions: ["HYBRID"],
    suggestedDisciplines: ["Fitness", "Yoga", "Pilates", "Cross training"],
    suggestedPlanTemplates: ["CLASS_MONTHLY", "GYM_UNLIMITED", "MIXED_MONTHLY"],
    keywords: ["hybride", "cours", "gym", "fitness", "studio"],
  },
  {
    key: "custom-class-club",
    label: "Autre club avec cours",
    description: "Commencez sans modèle et choisissez librement vos activités.",
    editions: ["CLASS"],
    suggestedDisciplines: [],
    suggestedPlanTemplates: ["CLASS_MONTHLY"],
    keywords: ["autre", "personnalise", "cours"],
  },
  {
    key: "custom-hybrid-club",
    label: "Autre club hybride",
    description: "Configurez librement les cours, l'accès libre et les formules combinées.",
    editions: ["HYBRID"],
    suggestedDisciplines: [],
    suggestedPlanTemplates: ["CLASS_MONTHLY", "GYM_UNLIMITED"],
    keywords: ["autre", "personnalise", "hybride"],
  },
] as const;

const templateByKey = new Map(ACTIVITY_TEMPLATES.map((template) => [template.key, template]));

export function activityTemplatesForEdition(edition: WorkspaceEdition): ActivityTemplate[] {
  return ACTIVITY_TEMPLATES.filter((template) => template.editions.includes(edition));
}

export function resolveActivityTemplateKeys(
  keys: readonly string[],
  edition: WorkspaceEdition,
): ActivityTemplateKey[] {
  return Array.from(new Set(keys)).filter((key): key is ActivityTemplateKey => {
    const template = templateByKey.get(key as ActivityTemplateKey);
    return Boolean(template?.editions.includes(edition));
  });
}

export function activityTemplateByKey(key: string): ActivityTemplate | null {
  return templateByKey.get(key as ActivityTemplateKey) ?? null;
}
