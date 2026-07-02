import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { SubscriptionPlansTable } from "@/components/subscription-plans/subscription-plans-table";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SubscriptionPlansPage() {
  let plans = [] as Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    totalSessions: number;
    sessionsPerWeek: number | null;
    validityDays: number;
    isActive: boolean;
    createdAt: Date;
    sport: { id: string; name: string } | null;
    _count: { subscriptions: number };
  }>;
  let hasError = false;

  try {
    plans = await prisma.subscriptionPlan.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { subscriptions: true } },
        sport: { select: { id: true, name: true } },
      },
    });
  } catch {
    hasError = true;
  }

  if (hasError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Formules indisponibles</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Cette page ne peut pas charger ses données pour le moment. Revenez au tableau de bord puis contactez le
            support si le problème continue.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <Link href="/subscriptions" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-3.5" /> Retour aux abonnements
      </Link>

      <PageHeader
        overline="Configuration"
        title="Formules"
        description={`${plans.length} formule${plans.length > 1 ? "s" : ""} configurée${plans.length > 1 ? "s" : ""}. Gérez les prix, quotas et validités vendus aux membres.`}
        actions={
          <Link
            href="/subscription-plans/new"
            className="btn btn-primary btn-block-mobile inline-flex items-center justify-center gap-1.5"
          >
            <Plus className="size-4" /> Nouvelle formule
          </Link>
        }
      />

      <section className="panel overflow-hidden">
        <SubscriptionPlansTable plans={plans} />
      </section>
    </main>
  );
}
