import Link from "next/link";

import { CoachManager } from "@/components/coaches/coach-manager";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";

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
        include: { sport: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.sport.findMany({ orderBy: { name: "asc" }, where: { isActive: true } }),
    ]);

    initialCoaches = coaches.map((coach) => ({
      id: coach.id,
      firstName: coach.firstName,
      lastName: coach.lastName,
      phone: coach.phone,
      email: coach.email,
      isActive: coach.isActive,
      sportId: coach.sportId,
      sportName: coach.sport?.name ?? null,
      createdAt: coach.createdAt.toISOString(),
      updatedAt: coach.updatedAt.toISOString(),
    }));

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
            Le modèle Prisma Coach n&apos;est pas accessible pour le moment. Lancez la régénération du client
            (`npm run prisma:generate`) puis redémarrez le serveur de développement.
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
        overline="Référentiels"
        title="Gestion des coachs"
        description="Référentiel des coachs avec spécialité sportive, activation et maintenance rapide."
      />
      <CoachManager initialCoaches={initialCoaches} sportsOptions={sportsOptions} />
    </main>
  );
}
