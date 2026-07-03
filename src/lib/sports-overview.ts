import { prisma } from "@/lib/prisma";
import { SportDto } from "@/types/sport";

type CountRow = {
  sportId: string | null;
  _count: {
    _all: number;
  };
};

function mapCountRows(rows: CountRow[]) {
  return new Map(
    rows
      .filter((row): row is CountRow & { sportId: string } => Boolean(row.sportId))
      .map((row) => [row.sportId, row._count._all]),
  );
}

export async function listSportOverviews({
  active,
  query,
}: {
  active?: boolean;
  query?: string;
} = {}): Promise<SportDto[]> {
  const trimmedQuery = query?.trim();
  const sports = await prisma.sport.findMany({
    where: {
      ...(active ? { isActive: true } : {}),
      ...(trimmedQuery
        ? {
            OR: [{ name: { contains: trimmedQuery } }, { description: { contains: trimmedQuery } }],
          }
        : {}),
    },
    orderBy: trimmedQuery ? { createdAt: "desc" } : { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const sportIds = sports.map((sport) => sport.id);

  if (sportIds.length === 0) {
    return [];
  }

  const [
    activeGroupRows,
    activePlanRows,
    activeSubscriptionRows,
    activeOfferRows,
    defaultCoaches,
    qualifiedCoaches,
  ] = await Promise.all([
    prisma.group.groupBy({
      by: ["sportId"],
      where: { sportId: { in: sportIds }, isActive: true },
      _count: { _all: true },
    }),
    prisma.subscriptionPlan.groupBy({
      by: ["sportId"],
      where: { sportId: { in: sportIds }, isActive: true },
      _count: { _all: true },
    }),
    prisma.memberSubscription.groupBy({
      by: ["sportId"],
      where: { sportId: { in: sportIds }, status: "ACTIVE" },
      _count: { _all: true },
    }),
    prisma.offer.groupBy({
      by: ["sportId"],
      where: { sportId: { in: sportIds }, isActive: true },
      _count: { _all: true },
    }),
    prisma.coach.findMany({
      where: { sportId: { in: sportIds }, isActive: true },
      select: { id: true, sportId: true },
    }),
    prisma.coachSportQualification.findMany({
      where: { sportId: { in: sportIds }, coach: { isActive: true } },
      select: { coachId: true, sportId: true },
    }),
  ]);

  const activeGroupsBySport = mapCountRows(activeGroupRows);
  const activePlansBySport = mapCountRows(activePlanRows);
  const activeSubscriptionsBySport = mapCountRows(activeSubscriptionRows);
  const activeOffersBySport = mapCountRows(activeOfferRows);
  const coachIdsBySport = new Map<string, Set<string>>();

  for (const sportId of sportIds) {
    coachIdsBySport.set(sportId, new Set());
  }

  for (const coach of defaultCoaches) {
    if (coach.sportId) {
      coachIdsBySport.get(coach.sportId)?.add(coach.id);
    }
  }

  for (const qualification of qualifiedCoaches) {
    coachIdsBySport.get(qualification.sportId)?.add(qualification.coachId);
  }

  return sports.map((sport) => ({
    ...sport,
    stats: {
      activeGroups: activeGroupsBySport.get(sport.id) ?? 0,
      activePlans: activePlansBySport.get(sport.id) ?? 0,
      activeSubscriptions: activeSubscriptionsBySport.get(sport.id) ?? 0,
      coaches: coachIdsBySport.get(sport.id)?.size ?? 0,
      activeOffers: activeOffersBySport.get(sport.id) ?? 0,
    },
    createdAt: sport.createdAt.toISOString(),
    updatedAt: sport.updatedAt.toISOString(),
  }));
}
