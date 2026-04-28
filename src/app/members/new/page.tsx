import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MemberAddForm } from "@/components/members/member-add-form";
import { PageHeader } from "@/components/ui/page-header";

export default function NewMemberPage() {
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
        title="Ajouter un membre"
        description="Créer un nouveau dossier membre. Les champs marqués * sont obligatoires."
      />

      <section className="panel panel-soft p-6">
        <MemberAddForm />
      </section>
    </main>
  );
}
