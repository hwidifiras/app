import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  const enabled = process.env.ALLOW_PUBLIC_REGISTER === "true";

  if (!enabled) {
    return (
      <main className="app-shell py-6 md:py-10">
        <div className="mx-auto w-full max-w-md">
          <PageHeader
            overline="Accès"
            title="Inscription indisponible"
            description="Les comptes staff sont créés par un administrateur du club."
          />
          <section className="panel panel-soft p-5 md:p-6">
            <p className="text-sm text-[var(--muted-foreground)]">
              Contactez la direction ou la réception pour obtenir vos identifiants.
            </p>
            <Link href="/login" className="btn btn-primary mt-4 inline-flex w-full justify-center">
              Retour à la connexion
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell py-6 md:py-10">
      <div className="mx-auto w-full max-w-md">
        <PageHeader
          overline="Accès"
          title="Créer un compte"
          description="Créez un compte staff pour accéder à l'interface réception."
        />

        <section className="panel panel-soft p-5 md:p-6">
          <RegisterForm />
        </section>
      </div>
    </main>
  );
}
