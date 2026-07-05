import type { SportDto } from "@/types/sport";

export type SportStatsDto = NonNullable<SportDto["stats"]>;

export const EMPTY_STATS: SportStatsDto = {
  activeGroups: 0,
  activePlans: 0,
  activeSubscriptions: 0,
  coaches: 0,
  activeOffers: 0,
};

export function withStats(sport: SportDto): SportDto {
  return {
    ...sport,
    stats: {
      ...EMPTY_STATS,
      ...(sport.stats ?? {}),
    },
  };
}

export function getMissingSetup(sport: SportDto) {
  const stats = sport.stats ?? EMPTY_STATS;
  const missing: string[] = [];
  if (stats.activeGroups === 0) missing.push("cours");
  if (stats.activePlans === 0) missing.push("formule");
  if (stats.coaches === 0) missing.push("coach");
  return missing;
}

export function completionState(sport: SportDto) {
  if (!sport.isActive) {
    return {
      label: "Inactive",
      detail: "Masquée des nouveaux flux.",
      variant: "muted" as const,
    };
  }

  const missing = getMissingSetup(sport);

  if (missing.length === 0) {
    return {
      label: "Prête",
      detail: "Cours, formule et coach configurés.",
      variant: "success" as const,
    };
  }

  return {
    label: "À compléter",
    detail: `Manque: ${missing.join(", ")}.`,
    variant: "warning" as const,
  };
}

export function plural(count: number, singular: string, pluralLabel = `${singular}s`) {
  return `${count} ${count > 1 ? pluralLabel : singular}`;
}
