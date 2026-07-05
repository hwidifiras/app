import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { OffersManager } from "@/components/offers/offers-manager";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const authUser = await getAuthUser();

  if (!authUser) {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Réglages"
          title="Offres"
          description="Connectez-vous pour gérer les offres."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  const sports = await prisma.sport.findMany({
    where: { tenantId: authUser.tenantId, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Réglages"
        title="Offres"
        description="Gérer les réductions famille, deuxième discipline et offres rapides."
        actions={
          <Link href="#offer-create" className="btn btn-primary btn-block-mobile">
            <Plus className="size-4" /> Ajouter une offre
          </Link>
        }
      />
      <Suspense fallback={<p className="text-sm text-[var(--muted-foreground)]">Chargement…</p>}>
        <OffersManager sportsOptions={sports} />
      </Suspense>
    </main>
  );
}
