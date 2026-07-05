import { headers } from "next/headers";
import Link from "next/link";
import {
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  Database,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";

import { SettingsMetric, SettingsTile } from "@/components/settings/settings-hub";
import { PageHeader } from "@/components/ui/page-header";
import { CLUB_DAY_SHORT_LABELS } from "@/lib/club-working-days";
import { getClubSettings } from "@/lib/club-settings";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsHomePage() {
  const h = await headers();
  const role = h.get("x-user-role");

  if (role !== "ADMIN") {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Réglages"
          title="Mon compte"
          description="Modifiez vos informations personnelles et votre mot de passe."
          actions={
            <Link href="/settings/account" className="btn btn-primary btn-block-mobile">
              <UserRound className="size-4" />
              Ouvrir mon compte
            </Link>
          }
        />
      </main>
    );
  }

  const [settings, activeGroups, activeSports, activePlans, activeOffers, users, templates] =
    await Promise.all([
      getClubSettings(),
      prisma.group.count({ where: { isActive: true } }),
      prisma.sport.count({ where: { isActive: true } }),
      prisma.subscriptionPlan.count({ where: { isActive: true } }),
      prisma.offer.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.scheduleTemplate.count({ where: { isActive: true } }),
    ]);

  const workingDaysLabel = settings.workingDays
    .map((day) => CLUB_DAY_SHORT_LABELS[day])
    .join(", ");

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Réglages"
        title="Centre de configuration"
        description="Pilotez les règles du club, les horaires, les documents, les accès et la reprise de données."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SettingsMetric label="Club" value={settings.clubName || "Non nommé"} detail={settings.clubPhone || "Téléphone à compléter"} />
        <SettingsMetric label="Jours ouverts" value={`${settings.workingDays.length} jours`} detail={workingDaysLabel || "À définir"} />
        <SettingsMetric label="Dette visible" value={formatMoney(settings.debtAlertThresholdCents)} detail="Seuil d'alerte réception" />
        <SettingsMetric label="Accès actifs" value={users} detail="Comptes utilisateurs" />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <SettingsTile
          href="/settings/club"
          icon={SlidersHorizontal}
          overline="Règles"
          title="Club, pointage et reçus"
          description="Logo, coordonnées, jours d'ouverture, conflits planning, pointage, seuils et numérotation des reçus."
          meta={[
            settings.receiptPrintDefault ? "Impression du reçu active" : "Impression du reçu manuelle",
            settings.receiptEmailDefault ? "Email du reçu automatique" : "Email du reçu manuel",
          ]}
        />
        <SettingsTile
          href="/settings/schedules"
          icon={CalendarClock}
          overline="Horaires"
          title="Saisons et horaires types"
          description="Créez des modèles hebdomadaires, appliquez-les aux groupes, puis générez les séances avec aperçu."
          meta={[`${templates} modèle${templates > 1 ? "s" : ""}`, `${activeGroups} groupe${activeGroups > 1 ? "s" : ""} actif${activeGroups > 1 ? "s" : ""}`]}
        />
        <SettingsTile
          href="/subscription-plans"
          secondaryHref="/offers"
          secondaryLabel="Offres"
          icon={CreditCard}
          overline="Ventes"
          title="Formules et offres"
          description="Gardez les tarifs, quotas de séances, disciplines et remises lisibles pour la réception."
          meta={[`${activePlans} formule${activePlans > 1 ? "s" : ""}`, `${activeOffers} offre${activeOffers > 1 ? "s" : ""}`]}
        />
        <SettingsTile
          href="/settings/data-import"
          icon={Database}
          overline="Reprise"
          title="Import ancien fichier"
          description="Préparez un fichier propre, contrôlez les erreurs et importez les élèves sans ressaisie manuelle."
          meta={["Excel / CSV", "Controle avant import"]}
        />
        <SettingsTile
          href="/sports"
          secondaryHref="/coaches"
          secondaryLabel="Coachs"
          icon={ClipboardCheck}
          overline="Catalogue"
          title="Disciplines et encadrement"
          description="Organisez les disciplines, les coachs, les specialites et les groupes qui structurent le planning."
          meta={[`${activeSports} discipline${activeSports > 1 ? "s" : ""}`, "Spécialités coachs"]}
        />
        <SettingsTile
          href="/settings/users"
          secondaryHref="/logs"
          secondaryLabel="Journal"
          icon={ShieldCheck}
          overline="Administration"
          title="Utilisateurs et tracabilite"
          description="Créez les comptes Admin, Réception et Coach, puis contrôlez les actions sensibles dans le journal."
          meta={["Rôles et permissions", "Actions tracées"]}
        />
      </section>
    </main>
  );
}
