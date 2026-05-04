import { PageHeader } from "@/components/ui/page-header";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="app-shell py-6 md:py-10">
      <div className="mx-auto w-full max-w-md">
        <PageHeader
          overline="Accès"
          title="Connexion"
          description="Connectez-vous pour accéder à l'interface réception."
        />

        <section className="panel panel-soft p-5 md:p-6">
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
