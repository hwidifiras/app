import Link from "next/link";
import {
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  Database,
  Dumbbell,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";

import { SettingsMetric, SettingsTile } from "@/components/settings/settings-hub";
import { PageHeader } from "@/components/ui/page-header";
import { CLUB_DAY_SHORT_LABELS } from "@/lib/club-working-days";
import { getClubSettings } from "@/lib/club-settings";
import { formatMoney } from "@/lib/money";
import { hasPermission } from "@/lib/permission-definitions";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/request-user";
import { getTenantProductContext } from "@/platform/product/product-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsHomePage() {
  const authUser = await getAuthUser();

  if (!authUser || (authUser.role !== "ADMIN" && !hasPermission(authUser.permissions, "settings.manage"))) {
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

  const product = await getTenantProductContext(authUser.tenantId);
  const hasClasses = product.capabilities.classManagement;
  const hasGym = product.capabilities.gymAccess;
  const canManageClasses = authUser.role === "ADMIN" || hasPermission(authUser.permissions, "class.manage");
  const canManageGym = authUser.role === "ADMIN" || hasPermission(authUser.permissions, "gym.manage");
  const canCheckInGym = authUser.role === "ADMIN" || hasPermission(authUser.permissions, "gym.checkin");
  const canManagePlans = authUser.role === "ADMIN" || hasPermission(authUser.permissions, "plans.manage");
  const planKinds = product.profile === "CLASS_ONLY"
    ? ["CLASS" as const]
    : product.profile === "GYM_ONLY"
      ? ["GYM" as const]
      : ["CLASS" as const, "GYM" as const, "MIXED" as const];

  const [settings, activeGroups, activeSports, activePlans, activeOffers, users, templates] =
    await Promise.all([
      getClubSettings(),
      hasClasses ? prisma.group.count({ where: { tenantId: authUser.tenantId, isActive: true } }) : Promise.resolve(0),
      hasClasses ? prisma.sport.count({ where: { tenantId: authUser.tenantId, isActive: true } }) : Promise.resolve(0),
      prisma.subscriptionPlan.count({ where: { tenantId: authUser.tenantId, isActive: true, planKind: { in: planKinds } } }),
      prisma.offer.count({ where: { tenantId: authUser.tenantId, isActive: true } }),
      prisma.user.count({ where: { tenantId: authUser.tenantId, isActive: true } }),
      hasClasses ? prisma.scheduleTemplate.count({ where: { tenantId: authUser.tenantId, isActive: true } }) : Promise.resolve(0),
    ]);

  const workingDaysLabel = settings.workingDays
    .map((day) => CLUB_DAY_SHORT_LABELS[day])
    .join(", ");

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Réglages"
        title="Centre de configuration"
        description={product.profile === "GYM_ONLY"
          ? "Pilotez les accès salle, les formules, les reçus et les comptes de votre équipe."
          : product.profile === "HYBRID"
            ? "Pilotez les cours, les accès salle, les documents et les règles communes du club."
            : "Pilotez les règles du club, les horaires, les documents, les accès et la reprise de données."}
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
        {hasClasses ? (
          <SettingsTile
            href="/settings/schedules"
            icon={CalendarClock}
            overline="Horaires"
            title="Saisons et horaires types"
            description="Créez des modèles hebdomadaires, appliquez-les aux groupes, puis générez les séances avec aperçu."
            meta={[`${templates} modèle${templates > 1 ? "s" : ""}`, `${activeGroups} groupe${activeGroups > 1 ? "s" : ""} actif${activeGroups > 1 ? "s" : ""}`]}
          />
        ) : null}
        {hasGym && canManageGym ? (
          <SettingsTile
            href={canCheckInGym ? "/gym/check-in" : "/gym/visits"}
            secondaryHref={canCheckInGym ? "/gym/visits" : undefined}
            secondaryLabel={canCheckInGym ? "Historique" : undefined}
            icon={Dumbbell}
            overline="Salle"
            title="Accès et passages"
            description="Contrôlez les admissions, les quotas de visites et les corrections traçables."
            meta={[product.profile === "HYBRID" ? "Module hybride actif" : "Module salle actif", "Accès sécurisés"]}
          />
        ) : null}
        {canManagePlans ? <SettingsTile
          href="/subscription-plans"
          secondaryHref="/offers"
          secondaryLabel="Offres"
          icon={CreditCard}
          overline="Ventes"
          title="Formules et offres"
          description="Gardez les tarifs, quotas de séances, disciplines et remises lisibles pour la réception."
          meta={[`${activePlans} formule${activePlans > 1 ? "s" : ""}`, `${activeOffers} offre${activeOffers > 1 ? "s" : ""}`]}
        /> : null}
        {hasClasses ? (
          <SettingsTile
            href="/settings/data-import"
            icon={Database}
            overline="Reprise"
            title="Import ancien fichier"
            description="Préparez un fichier propre, contrôlez les erreurs et importez les élèves sans ressaisie manuelle."
            meta={["Excel / CSV", "Contrôle avant import"]}
          />
        ) : null}
        {hasClasses && canManageClasses ? (
          <SettingsTile
            href="/sports"
            secondaryHref="/coaches"
            secondaryLabel="Coachs"
            icon={ClipboardCheck}
            overline="Catalogue"
            title="Disciplines et encadrement"
            description="Organisez les disciplines, les coachs, les spécialités et les groupes qui structurent le planning."
            meta={[`${activeSports} discipline${activeSports > 1 ? "s" : ""}`, "Spécialités coachs"]}
          />
        ) : null}
        {authUser.role === "ADMIN" ? <SettingsTile
          href="/settings/users"
          secondaryHref="/logs"
          secondaryLabel="Journal"
          icon={ShieldCheck}
          overline="Administration"
          title="Utilisateurs et tracabilite"
          description="Créez les comptes Admin, Réception et Coach, puis contrôlez les actions sensibles dans le journal."
          meta={["Rôles et permissions", "Actions tracées"]}
        /> : null}
      </section>
    </main>
  );
}
