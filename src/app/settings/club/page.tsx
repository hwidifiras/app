import { headers } from "next/headers";

import { ClubSettingsForm } from "@/components/settings/club-settings-form";
import { ReceptionRulesCard } from "@/components/settings/reception-rules-card";
import { SettingsMetric } from "@/components/settings/settings-hub";
import { PageHeader } from "@/components/ui/page-header";
import { CLUB_DAY_SHORT_LABELS } from "@/lib/club-working-days";
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
          overline="Réglages"
          title="Club"
          description="Seul un administrateur peut modifier ces réglages."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  const settings = await getClubSettings();
  const workingDaysLabel = settings.workingDays
    .map((day) => CLUB_DAY_SHORT_LABELS[day])
    .join(", ");
  const pointagePolicy = settings.allowCheckInWithPartialPayment
    ? "Paiement partiel accepté"
    : "Paiement complet demandé";
  const receiptPolicy = [
    settings.receiptPrintDefault ? "Impression proposée" : "Impression manuelle",
    settings.receiptEmailDefault ? "Email automatique" : "Email manuel",
  ].join(" · ");

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Réglages"
        title="Club"
        description="Personnaliser logo, coordonnées et règles de pointage utilisées par la réception."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SettingsMetric label="Club" value={settings.clubName || "Non nommé"} detail={settings.clubPhone || "Téléphone à compléter"} />
        <SettingsMetric label="Jours ouverts" value={`${settings.workingDays.length} jours`} detail={workingDaysLabel || "À définir"} />
        <SettingsMetric label="Pointage" value={settings.absentConsumesSession ? "Absence déduite" : "Absence non déduite"} detail={pointagePolicy} />
        <SettingsMetric label="Reçus" value={settings.receiptPrefix} detail={receiptPolicy} />
      </section>

      <div className="mt-5 grid w-full gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="xl:order-2">
          <ReceptionRulesCard />
        </section>

        <section className="min-w-0 xl:order-1">
          <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)]">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
              Préférences du club
            </p>
            <h2 className="mt-1 text-base font-black text-[var(--foreground)]">Règles opérationnelles</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[var(--muted-foreground)]">
              Ces réglages changent le comportement quotidien du pointage, du planning, des remises et des reçus.
              Les changements sensibles sont conservés dans le journal d&apos;actions.
            </p>
            <p className="mt-3 text-xs text-[var(--muted-foreground)]">
              Fermer un jour d&apos;ouverture est bloqué si des séances ou horaires actifs existent encore sur ce jour.
            </p>
          </div>

        <ClubSettingsForm
          initial={{
            clubName: settings.clubName,
            clubLogoUrl: settings.clubLogoUrl ?? "",
            clubAddress: settings.clubAddress,
            clubPhone: settings.clubPhone,
            allowCheckInWithPartialPayment: settings.allowCheckInWithPartialPayment,
            allowCheckInWithoutSubscription: settings.allowCheckInWithoutSubscription,
            absentConsumesSession: settings.absentConsumesSession,
            allowSameRoomConcurrentGroups: settings.allowSameRoomConcurrentGroups,
            allowCoachConcurrentSameRoomQualified: settings.allowCoachConcurrentSameRoomQualified,
            workingDays: settings.workingDays,
            maxStaffDiscountPercent: settings.maxStaffDiscountPercent,
            debtAlertThresholdCents: settings.debtAlertThresholdCents,
            receiptPrefix: settings.receiptPrefix,
            nextReceiptSequence: settings.nextReceiptSequence,
            receiptFooter: settings.receiptFooter,
            receiptEmailDefault: settings.receiptEmailDefault,
            receiptPrintDefault: settings.receiptPrintDefault,
          }}
        />
        </section>
      </div>
    </main>
  );
}
