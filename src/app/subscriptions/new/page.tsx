import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { SubscriptionAddForm } from "@/components/subscriptions/subscription-add-form";

export default async function NewSubscriptionPage() {
  let hasError = false;
  let membersOptions: Array<{ id: string; firstName: string; lastName: string; phone: string }> = [];
  let plansOptions: Array<{ id: string; name: string; price: number; totalSessions: number; validityDays: number }> = [];

  try {
    const [members, plans] = await Promise.all([
      prisma.member.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { id: true, firstName: true, lastName: true, phone: true },
      }),
      prisma.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, price: true, totalSessions: true, validityDays: true },
      }),
    ]);

    membersOptions = members;
    plansOptions = plans;
  } catch {
    hasError = true;
  }

  if (hasError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Création d&apos;abonnement indisponible</h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Données inaccessibles. Lancez `npm run prisma:generate` puis redémarrez le serveur.
          </p>
          <div className="mt-4">
            <Link href="/subscriptions" className="btn btn-ghost">Retour aux abonnements</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href="/subscriptions"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Retour à la liste
      </Link>

      <PageHeader
        overline="Abonnements & Finance"
        title="Nouvel abonnement"
        description="Créer un abonnement pour un membre existant. Sélectionnez un plan pour auto-remplir le montant et la durée."
      />

      <section className="panel panel-soft p-6">
        <SubscriptionAddForm membersOptions={membersOptions} plansOptions={plansOptions} />
      </section>
    </main>
  );
}
