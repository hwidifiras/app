import { headers } from "next/headers";

import { ClubSettingsForm } from "@/components/settings/club-settings-form";
import { ReceptionRulesCard } from "@/components/settings/reception-rules-card";
import { PageHeader } from "@/components/ui/page-header";
import { getClubSettings } from "@/lib/club-settings";

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

  const settings = await getClubSettings();

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Paramètres"
        title="Règles du club"
        description="Personnalisez l'identité du club et les règles appliquées à la réception."
      />

      <div className="mx-auto w-full max-w-5xl">
        <section className="mb-4">
          <ReceptionRulesCard />
        </section>

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
          }}
        />
      </div>
    </main>
  );
}
