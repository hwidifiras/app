import Link from "next/link";

import { SportManager } from "@/components/sports/sport-manager";
import { PageHeader } from "@/components/ui/page-header";
import { getAuthUser } from "@/lib/request-user";
import { listSportOverviews } from "@/lib/sports-overview";
import { SportDto } from "@/types/sport";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SportsPage() {
  const authUser = await getAuthUser();

  if (!authUser) {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Club"
          title="Disciplines"
          description="Connectez-vous pour gérer les disciplines du club."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  let hasSportDataError = false;
  let initialSports: SportDto[] = [];

  try {
    initialSports = await listSportOverviews({ tenantId: authUser.tenantId });
  } catch (error) {
    hasSportDataError = true;
    console.error("Sports page degraded mode due to Prisma model mismatch:", error);
  }

  if (hasSportDataError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Gestion des disciplines indisponible</h1>
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
        overline="Club"
        title="Disciplines"
        description="Gérer les disciplines proposées par le club."
      />
      <SportManager initialSports={initialSports} />
    </main>
  );
}
