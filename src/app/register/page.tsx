import Link from "next/link";
import { headers } from "next/headers";

import { PageHeader } from "@/components/ui/page-header";
import { RegisterForm } from "@/components/auth/register-form";
import { getClubSettings } from "@/lib/club-settings";
import {
  isPublicRegistrationGloballyEnabled,
  resolvePublicRegistrationPolicy,
} from "@/lib/registration-policy";
import { enterTenantContext } from "@/lib/tenant-context";
import { resolveTenantFromHost } from "@/lib/tenant-resolver";

async function isRegistrationEnabledForRequest(): Promise<boolean> {
  if (!isPublicRegistrationGloballyEnabled()) return false;

  const requestHeaders = await headers();
  const tenant = await resolveTenantFromHost(
    requestHeaders.get("host") ?? requestHeaders.get("x-forwarded-host"),
  );
  if (!tenant.ok) return false;

  enterTenantContext(tenant.context);
  const settings = await getClubSettings({ tenantId: tenant.context.tenantId });
  return resolvePublicRegistrationPolicy(settings.allowPublicRegister).enabled;
}

export default async function RegisterPage() {
  const enabled = await isRegistrationEnabledForRequest();

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
          description="Envoyez votre demande d'accès à l'administrateur du club."
        />

        <section className="panel panel-soft p-5 md:p-6">
          <RegisterForm />
        </section>
      </div>
    </main>
  );
}
