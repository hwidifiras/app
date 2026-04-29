import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

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
    _count: { subscriptions: number };
  }>;
  let hasError = false;

  try {
    plans = await prisma.subscriptionPlan.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { subscriptions: true } } },
    });
  } catch {
    hasError = true;
  }

  if (hasError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Plans indisponibles</h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">Données inaccessibles.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <Link href="/subscriptions" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline">
        <ArrowLeft className="size-3.5" /> Retour aux abonnements
      </Link>

      <PageHeader
        overline="Abonnements & Finance"
        title="Plans d'abonnement"
        description={`${plans.length} plan${plans.length > 1 ? "s" : ""} configuré${plans.length > 1 ? "s" : ""}. Créez et gérez les forfaits proposés aux membres.`}
      />

      <div className="mb-4 flex justify-end">
        <Link href="/subscription-plans/new" className="btn btn-primary inline-flex items-center gap-1.5">
          <Plus className="size-4" /> Nouveau plan
        </Link>
      </div>

      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Nom</th>
                <th className="px-4 py-3 text-left font-semibold">Description</th>
                <th className="px-4 py-3 text-right font-semibold">Prix</th>
                <th className="px-4 py-3 text-center font-semibold">Séances</th>
                <th className="px-4 py-3 text-center font-semibold">Sem.</th>
                <th className="px-4 py-3 text-center font-semibold">Validité</th>
                <th className="px-4 py-3 text-center font-semibold">Statut</th>
                <th className="px-4 py-3 text-center font-semibold">Souscriptions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-[var(--surface-soft)]">
                  <td className="px-4 py-3 font-medium">{plan.name}</td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">{plan.description ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(plan.price / 100)}
                  </td>
                  <td className="px-4 py-3 text-center">{plan.totalSessions}</td>
                  <td className="px-4 py-3 text-center">{plan.sessionsPerWeek ?? "—"}</td>
                  <td className="px-4 py-3 text-center">{plan.validityDays}j</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge variant={plan.isActive ? "success" : "muted"}>{plan.isActive ? "Actif" : "Inactif"}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-center">{plan._count.subscriptions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
