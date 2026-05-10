import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { SubscriptionPlanForm } from "@/components/subscription-plans/subscription-plan-form";

export default async function EditSubscriptionPlanPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id },
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
    },
  });

  if (!plan) {
    return (
      <main className="app-shell py-6 md:py-8">
        <div className="panel panel-soft p-6">
          <h1 className="text-2xl font-semibold text-foreground">Plan introuvable</h1>
          <p className="mt-2 text-sm text-muted-foreground">Le plan demandé n&apos;existe pas ou a été supprimé.</p>
          <Link href="/subscription-plans" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="size-3.5" /> Retour aux plans
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <Link href="/subscription-plans" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-3.5" /> Retour aux plans
      </Link>

      <PageHeader
        overline="Abonnements & Finance"
        title="Modifier un plan"
        description="Mettre à jour le tarif, la durée, les séances ou le statut d&apos;un forfait."
      />

      <section className="panel panel-soft p-6">
        <SubscriptionPlanForm
          mode="edit"
          planId={plan.id}
          initialValues={{
            name: plan.name,
            description: plan.description,
            price: plan.price,
            totalSessions: plan.totalSessions,
            sessionsPerWeek: plan.sessionsPerWeek,
            validityDays: plan.validityDays,
            sportId: plan.sportId,
            isActive: plan.isActive,
          }}
        />
      </section>
    </main>
  );
}