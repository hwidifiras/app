import { DataImportWizard } from "@/components/settings/data-import-wizard";
import { SettingsMetric } from "@/components/settings/settings-hub";
import { PageHeader } from "@/components/ui/page-header";
import { ReceptionInfoCard } from "@/components/ui/reception-info-card";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/request-user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DataImportPage() {
  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== "ADMIN") {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Réglages"
          title="Import ancien fichier"
          description="Seul un administrateur peut ouvrir un import depuis un ancien registre."
        />
        <section className="panel p-5 text-sm text-[var(--muted-foreground)]">Accès refusé.</section>
      </main>
    );
  }

  const [groups, plans] = await Promise.all([
    prisma.group.findMany({
      where: { tenantId: authUser.tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        groupType: true,
        sportId: true,
        sport: { select: { name: true } },
      },
    }),
    prisma.subscriptionPlan.findMany({
      where: { tenantId: authUser.tenantId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sportId: true,
        price: true,
        totalSessions: true,
        validityDays: true,
      },
    }),
  ]);

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Réglages"
        title="Reprise des anciens membres"
        description="Démarrez proprement avec l'état réel du club: groupe actuel, formule, validité, séances restantes et solde."
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SettingsMetric label="Groupes actifs" value={groups.length} detail="Cibles disponibles" />
        <SettingsMetric label="Formules" value={plans.length} detail="Compatibles par discipline" />
        <SettingsMetric label="Dates à saisir" value="1" detail="Date de reprise globale" />
        <SettingsMetric label="Fenêtre" value="4 heures" detail="Mode temporaire admin" />
      </section>

      <section className="mb-5 grid gap-3 lg:grid-cols-2">
        <ReceptionInfoCard title="Quand utiliser cette page" variant="info">
          <p>
            Utilisez la reprise pour les membres déjà actifs dans le club. Ne cherchez pas l&apos;historique exact: saisissez
            seulement la situation réelle au jour de bascule.
          </p>
        </ReceptionInfoCard>
        <ReceptionInfoCard title="Ce qui est créé" variant="warning">
          <p>
            L&apos;application crée le membre, son groupe actuel et son abonnement actif à partir de la date de reprise. Les
            dettes viennent de la différence entre montant à suivre et déjà payé.
          </p>
        </ReceptionInfoCard>
      </section>

      <div className="mx-auto w-full max-w-6xl">
        <DataImportWizard
          groups={groups.map((group) => ({
            id: group.id,
            name: group.name,
            groupType: group.groupType,
            sportId: group.sportId,
            sportName: group.sport.name,
          }))}
          plans={plans}
        />
      </div>
    </main>
  );
}
