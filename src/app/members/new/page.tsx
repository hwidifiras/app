import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MemberAddForm } from "@/components/members/member-add-form";
import { PageHeader } from "@/components/ui/page-header";
import { prisma } from "@/lib/prisma";

export default async function NewMemberPage() {
  let hasError = false;
  let groupsOptions: Array<{ id: string; name: string }> = [];
  let plansOptions: Array<{ id: string; name: string; price: number; totalSessions: number; validityDays: number }> = [];

  try {
    const [groups, plans] = await Promise.all([
      prisma.group.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, price: true, totalSessions: true, validityDays: true },
      }),
    ]);

    groupsOptions = groups;
    plansOptions = plans;
  } catch {
    hasError = true;
  }

  if (hasError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Inscription indisponible</h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Données inaccessibles. Lancez `npm run prisma:generate` puis redémarrez le serveur.
          </p>
          <div className="mt-4">
            <Link href="/members" className="btn btn-ghost">Retour aux membres</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href="/members"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Retour à la liste
      </Link>

      <PageHeader
        overline="Parcours réception"
        title="Nouvelle inscription"
        description="Créer un membre, l’affecter à un groupe et souscrire un abonnement en une seule étape. Les champs marqués * sont obligatoires."
      />

      <section className="panel panel-soft p-6">
        <MemberAddForm groupsOptions={groupsOptions} plansOptions={plansOptions} />
      </section>
    </main>
  );
}
