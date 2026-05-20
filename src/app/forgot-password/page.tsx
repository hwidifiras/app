import { PageHeader } from "@/components/ui/page-header";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="app-shell py-6 md:py-10">
      <div className="mx-auto w-full max-w-md">
        <PageHeader
          overline="Accès"
          title="Mot de passe oublié"
          description="Recevez un lien sécurisé pour créer un nouveau mot de passe."
        />

        <section className="panel panel-soft p-5 md:p-6">
          <ForgotPasswordForm />
        </section>
      </div>
    </main>
  );
}
