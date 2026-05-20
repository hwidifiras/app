import { PageHeader } from "@/components/ui/page-header";
import { AccountSettingsForm } from "@/components/settings/account-settings-form";

export const dynamic = "force-dynamic";

export default function SettingsAccountPage() {
  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Paramètres"
        title="Mon compte"
        description="Modifiez votre nom, votre email de connexion et votre mot de passe."
      />

      <section className="panel p-4 sm:p-5 md:p-6">
        <AccountSettingsForm />
      </section>
    </main>
  );
}
