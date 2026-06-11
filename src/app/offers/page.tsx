import { Suspense } from "react";

import { OffersManager } from "@/components/offers/offers-manager";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function OffersPage() {
  const sports = await prisma.sport.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Réception"
        title="Offres promotionnelles"
        description="Réductions famille, 2e discipline, ou offre rapide en %."
      />
      <Suspense fallback={<p className="text-sm text-[var(--muted-foreground)]">Chargement…</p>}>
        <OffersManager sportsOptions={sports} />
      </Suspense>
    </main>
  );
}
