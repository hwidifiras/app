import Link from "next/link";

import { CoachManager } from "@/components/coaches/coach-manager";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CoachesPage() {
  let hasCoachDataError = false;
  let initialCoaches: Array<{
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    isActive: boolean;
    sportId: string | null;
    sportName: string | null;
    qualifiedSportIds: string[];
    qualifiedSports: Array<{ id: string; name: string; isPrimary: boolean }>;
    createdAt: string;
    updatedAt: string;
  }> = [];
  let sportsOptions: Array<{
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }> = [];

  try {
    const [coaches, sports] = await Promise.all([
      prisma.coach.findMany({
        include: {
          sport: { select: { id: true, name: true } },
          qualifications: {
            include: { sport: { select: { id: true, name: true } } },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.sport.findMany({ orderBy: { name: "asc" }, where: { isActive: true } }),
    ]);

    initialCoaches = coaches.map((coach) => {
      const qualifiedSportsById = new Map<string, { id: string; name: string; isPrimary: boolean }>();
      for (const qualification of coach.qualifications) {
        qualifiedSportsById.set(qualification.sport.id, {
          id: qualification.sport.id,
          name: qualification.sport.name,
          isPrimary: qualification.isPrimary,
        });
      }
      if (coach.sport) {
        qualifiedSportsById.set(coach.sport.id, {
          id: coach.sport.id,
          name: coach.sport.name,
          isPrimary: true,
        });
      }
      const qualifiedSports = Array.from(qualifiedSportsById.values()).sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return a.name.localeCompare(b.name, "fr");
      });

      return {
        id: coach.id,
        firstName: coach.firstName,
        lastName: coach.lastName,
        phone: coach.phone,
        email: coach.email,
        isActive: coach.isActive,
        sportId: coach.sportId,
        sportName: coach.sport?.name ?? null,
        qualifiedSportIds: qualifiedSports.map((sport) => sport.id),
        qualifiedSports,
        createdAt: coach.createdAt.toISOString(),
        updatedAt: coach.updatedAt.toISOString(),
      };
    });

    sportsOptions = sports.map((sport) => ({
      ...sport,
      createdAt: sport.createdAt.toISOString(),
      updatedAt: sport.updatedAt.toISOString(),
    }));
  } catch (error) {
    hasCoachDataError = true;
    console.error("Coaches page degraded mode due to Prisma model mismatch:", error);
  }

  if (hasCoachDataError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Gestion des coachs indisponible</h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Cette page ne peut pas charger ses données pour le moment. Revenez au tableau de bord puis contactez le
            support si le problème continue.
          </p>
          <div className="mt-4">
            <Link href="/" className="btn btn-ghost">
              Retour au dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Configuration"
        title="Coachs"
        description="Gérer les coachs, leurs spécialités et leur disponibilité."
      />
      <CoachManager initialCoaches={initialCoaches} sportsOptions={sportsOptions} />
    </main>
  );
}
