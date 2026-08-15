import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { SubscriptionPlanForm } from "@/components/subscription-plans/subscription-plan-form";
import { getAuthUser } from "@/lib/request-user";
import { isTenantModuleEnabled } from "@/lib/tenant-modules";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EditSubscriptionPlanPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  const authUser = await getAuthUser();

  if (!authUser) {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Réglages"
          title="Modifier la formule"
          description="Connectez-vous pour modifier une formule."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  const plan = await prisma.subscriptionPlan.findFirst({
    where: { id, tenantId: authUser.tenantId },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      totalSessions: true,
      sessionsPerWeek: true,
      validityDays: true,
      isActive: true,
      sportId: true,
      planKind: true,
      entitlements: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!plan) {
    return (
      <main className="app-shell py-6 md:py-8">
        <div className="panel panel-soft p-6">
          <h1 className="text-2xl font-semibold text-foreground">Formule introuvable</h1>
          <p className="mt-2 text-sm text-muted-foreground">La formule demandée n&apos;existe pas ou a été supprimée.</p>
          <Link href="/subscription-plans" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="size-3.5" /> Retour aux formules
          </Link>
        </div>
      </main>
    );
  }
  const gymModuleEnabled = await isTenantModuleEnabled(authUser.tenantId, "GYM_ACCESS");

  return (
    <main className="app-shell py-4 md:py-8">
      <Link href="/subscription-plans" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-3.5" /> Retour aux formules
      </Link>

      <PageHeader
        overline="Réglages"
        title="Modifier la formule"
        description="Mettre à jour le tarif, la durée, les séances ou le statut."
      />

      <section className="panel p-4 sm:p-6">
        <SubscriptionPlanForm
          mode="edit"
          planId={plan.id}
          gymModuleEnabled={gymModuleEnabled}
          initialValues={{
            name: plan.name,
            description: plan.description,
            price: plan.price,
            totalSessions: plan.totalSessions,
            sessionsPerWeek: plan.sessionsPerWeek,
            validityDays: plan.validityDays,
            sportId: plan.sportId,
            planKind: plan.planKind,
            entitlements: plan.entitlements,
            isActive: plan.isActive,
          }}
        />
      </section>
    </main>
  );
}
