import Link from "next/link";
import { MemberAddForm } from "@/components/members/member-add-form";

export default function NewMemberPage() {
  return (
    <main className="app-shell py-4 md:py-8">
      <div className="mb-5 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Parcours réception</p>
        <h1 className="text-2xl font-semibold text-[var(--foreground)] md:text-3xl">Ajouter un membre</h1>
        <p className="text-sm text-[var(--muted)]">
          Créer un nouveau dossier membre. Les champs marqués sont obligatoires.
        </p>
      </div>

      <section className="panel panel-soft p-6">
        <MemberAddForm />
      </section>

      <div className="mt-4">
        <Link href="/members" className="text-sm font-medium text-[var(--primary)] underline">
          ← Retour à la liste des membres
        </Link>
      </div>
    </main>
  );
}
