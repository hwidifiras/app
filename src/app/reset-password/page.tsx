import { Suspense } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="app-shell py-6 md:py-10">
      <div className="mx-auto w-full max-w-md">
        <PageHeader
          overline="Accès"
          title="Nouveau mot de passe"
          description="Choisissez un mot de passe sécurisé pour votre compte."
        />

        <section className="panel panel-soft p-5 md:p-6">
          <Suspense fallback={<p className="text-sm text-[var(--muted-foreground)]">Chargement...</p>}>
            <ResetPasswordForm />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
