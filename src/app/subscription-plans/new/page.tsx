import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { PlanAddForm } from "@/components/subscription-plans/plan-add-form";

export default function NewPlanPage() {
  return (
    <main className="app-shell py-4 md:py-8">
      <Link href="/subscription-plans" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline">
        <ArrowLeft className="size-3.5" /> Retour aux plans
      </Link>

      <PageHeader
        overline="Abonnements & Finance"
        title="Nouveau plan"
        description="Créer un forfait d'abonnement avec tarif et durée."
      />

      <section className="panel panel-soft p-6">
        <PlanAddForm />
      </section>
    </main>
  );
}
