import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { SubscriptionAddForm } from "@/components/subscriptions/subscription-add-form";
import { getAuthUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewSubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ memberId?: string }>;
}) {
  const { memberId: requestedMemberId } = await searchParams;
  const authUser = await getAuthUser();

  if (!authUser) {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Ventes"
          title="Renouveler"
          description="Connectez-vous pour créer un abonnement."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  let hasError = false;
  let membersOptions: Array<{ id: string; firstName: string; lastName: string; phone: string }> = [];
  let plansOptions: Array<{ id: string; name: string; price: number; totalSessions: number; validityDays: number }> = [];

  try {
    const [members, plans] = await Promise.all([
      prisma.member.findMany({
        where: { tenantId: authUser.tenantId, status: "ACTIVE" },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: { id: true, firstName: true, lastName: true, phone: true },
      }),
      prisma.subscriptionPlan.findMany({
        where: { tenantId: authUser.tenantId, isActive: true },
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
            Cette page ne peut pas charger ses données pour le moment. Revenez au tableau de bord puis contactez le
            support si le problème continue.
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
        overline="Ventes"
        title="Renouveler"
        description="Créer un nouvel abonnement sans perdre l'historique du membre."
      />

      <SubscriptionAddForm
        membersOptions={membersOptions}
        plansOptions={plansOptions}
        initialMemberId={membersOptions.some((member) => member.id === requestedMemberId) ? requestedMemberId : ""}
      />
    </main>
  );
}
