import { SportManager } from "@/components/sports/sport-manager";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

type SportRecord = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export default async function SportsPage() {
  let hasSportDataError = false;
  let initialSports: Array<{
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }> = [];

  try {
    const sports: SportRecord[] = await prisma.sport.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    initialSports = sports.map((sport) => ({
      ...sport,
      createdAt: sport.createdAt.toISOString(),
      updatedAt: sport.updatedAt.toISOString(),
    }));
  } catch (error) {
    hasSportDataError = true;
    console.error("Sports page degraded mode due to Prisma model mismatch:", error);
  }

  if (hasSportDataError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Gestion des sports indisponible</h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Le modèle Prisma Sport n&apos;est pas accessible pour le moment. Lancez la régénération du client
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
        title="Gestion des sports"
        description="Référentiel des disciplines du club avec activation et maintenance rapide."
      />
      <SportManager initialSports={initialSports} />
    </main>
  );
}
