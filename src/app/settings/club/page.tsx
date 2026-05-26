import { headers } from "next/headers";

import { SetupGuideAdminPanel } from "@/components/onboarding/setup-guide-admin-panel";
import { ClubSettingsForm } from "@/components/settings/club-settings-form";
import { ReceptionRulesCard } from "@/components/settings/reception-rules-card";
import { PageHeader } from "@/components/ui/page-header";
import { getClubSettings } from "@/lib/club-settings";
import { getSetupGuideProgress } from "@/lib/setup-guide";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsClubPage() {
  const h = await headers();
  const role = h.get("x-user-role");

  if (role !== "ADMIN") {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Paramètres"
          title="Règles du club"
          description="Seul un administrateur peut modifier les règles métier."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  const [settings, guideProgress] = await Promise.all([getClubSettings(), getSetupGuideProgress()]);

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Paramètres"
        title="Règles du club"
        description="Identité du club, pointage, dettes et remises staff."
      />

      <section className="mb-4">
        <ReceptionRulesCard />
      </section>

      <section className="panel p-4 sm:p-5 md:p-6">
        <ClubSettingsForm
          initial={{
            clubName: settings.clubName,
            clubLogoUrl: settings.clubLogoUrl ?? "",
            clubAddress: settings.clubAddress,
            clubPhone: settings.clubPhone,
            allowCheckInWithPartialPayment: settings.allowCheckInWithPartialPayment,
            allowCheckInWithoutSubscription: settings.allowCheckInWithoutSubscription,
            absentConsumesSession: settings.absentConsumesSession,
            maxStaffDiscountPercent: settings.maxStaffDiscountPercent,
            debtAlertThresholdCents: settings.debtAlertThresholdCents,
            updatedAt: settings.updatedAt.toISOString(),
          }}
        />
      </section>

      <SetupGuideAdminPanel progress={guideProgress} />
    </main>
  );
}
