import { PageHeader } from "@/components/ui/page-header";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
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