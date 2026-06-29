import { SportManager } from "@/components/sports/sport-manager";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
        title="Disciplines"
        description="Gérer les disciplines proposées par le club."
      />
      <SportManager initialSports={initialSports} />
    </main>
  );
}
