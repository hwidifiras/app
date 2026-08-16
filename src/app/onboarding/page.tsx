import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2, LockKeyhole, SlidersHorizontal } from "lucide-react";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getAuthUser } from "@/lib/request-user";
import {
  getTenantOnboardingState,
  TenantOnboardingError,
} from "@/platform/onboarding/tenant-onboarding-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Configurer votre club | We Discipline",
  description: "Préparez les modules, activités et règles d’accueil de votre espace.",
};

export default async function OnboardingPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login?next=/onboarding");
  if (user.role !== "ADMIN") redirect("/");

  let state;
  try {
    state = await getTenantOnboardingState(user.tenantId);
  } catch (error) {
    if (error instanceof TenantOnboardingError && error.status === 404) redirect("/");
    throw error;
  }
  if (state.status === "COMPLETED") redirect("/");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <OnboardingWizard initialState={state} />
        <aside className="space-y-3 lg:sticky lg:top-6">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-xs font-bold uppercase text-[var(--muted-foreground)]">Configuration sûre</p>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="flex gap-2"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-emerald-600" /><span>Votre espace et vos données restent isolés.</span></li>
              <li className="flex gap-2"><SlidersHorizontal className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" /><span>Chaque règle pourra être modifiée plus tard.</span></li>
              <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--primary)]" /><span>Aucune donnée de démonstration ne sera créée.</span></li>
            </ul>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-4 text-xs leading-5 text-[var(--muted-foreground)]">
            <p className="font-bold text-[var(--foreground)]">Vous pourrez reprendre plus tard</p>
            <p className="mt-1.5">Chaque étape est enregistrée avant de continuer. Une reconnexion vous ramène au bon endroit.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
