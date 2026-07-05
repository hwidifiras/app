import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SubscriptionPlanForm } from "@/components/subscription-plans/subscription-plan-form";
import { getAuthUser } from "@/lib/request-user";

export default async function NewPlanPage() {
  const authUser = await getAuthUser();

  if (!authUser) {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Réglages"
          title="Nouvelle formule"
          description="Connectez-vous pour créer une formule."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <Link href="/subscription-plans" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline">
        <ArrowLeft className="size-3.5" /> Retour aux formules
      </Link>

      <PageHeader
        overline="Réglages"
        title="Nouvelle formule"
        description="Créer une formule avec tarif, durée et nombre de séances."
      />

      <section className="panel p-4 sm:p-6">
        <SubscriptionPlanForm mode="create" />
      </section>
    </main>
  );
}
