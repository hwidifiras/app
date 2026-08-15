import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { OffersManager } from "@/components/offers/offers-manager";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/request-user";
import { getTenantProductContext } from "@/platform/product/product-context";

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

  const product = await getTenantProductContext(authUser.tenantId);
  const sports = product.capabilities.classManagement
    ? await prisma.sport.findMany({
        where: { tenantId: authUser.tenantId, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];
  const allowedPlanScopes = product.profile === "CLASS_ONLY"
    ? ["ALL" as const, "CLASS" as const]
    : product.profile === "GYM_ONLY"
      ? ["ALL" as const, "GYM" as const]
      : ["ALL" as const, "CLASS" as const, "GYM" as const, "MIXED" as const];

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
        <OffersManager
          sportsOptions={sports}
          allowedPlanScopes={allowedPlanScopes}
          classModuleEnabled={product.capabilities.classManagement}
        />
      </Suspense>
    </main>
  );
}
