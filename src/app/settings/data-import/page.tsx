import { DataImportWizard } from "@/components/settings/data-import-wizard";
import { SettingsMetric } from "@/components/settings/settings-hub";
import { PageHeader } from "@/components/ui/page-header";
import { ReceptionInfoCard } from "@/components/ui/reception-info-card";
import { getWeekRangeUtc } from "@/lib/dates";
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

  const now = new Date();
  const { start } = getWeekRangeUtc(now);
  const [groups, plans, sessions] = await Promise.all([
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
    prisma.session.findMany({
      where: {
        tenantId: authUser.tenantId,
        sessionDate: { gte: start, lte: now },
        status: { not: "CANCELLED" },
      },
      orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        groupId: true,
        sessionDate: true,
        startTime: true,
        group: { select: { name: true } },
      },
    }),
  ]);

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Réglages"
        title="Import ancien fichier"
        description="Importer l'état réel d'un adhérent actif depuis un registre papier ou Excel, sans recréer artificiellement un abonnement neuf."
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SettingsMetric label="Groupes actifs" value={groups.length} detail="Cibles disponibles" />
        <SettingsMetric label="Formules" value={plans.length} detail="Compatibles par discipline" />
        <SettingsMetric label="Pointages récents" value={sessions.length} detail="Séances de la semaine" />
        <SettingsMetric label="Fenêtre" value="4 heures" detail="Mode temporaire admin" />
      </section>

      <section className="mb-5 grid gap-3 lg:grid-cols-2">
        <ReceptionInfoCard title="Quand utiliser cette page" variant="info">
          <p>
            Utilisez la reprise uniquement pour migrer un membre déjà actif depuis un ancien registre. Pour une nouvelle
            vente normale, utilisez plutôt Inscrire ou Encaisser.
          </p>
        </ReceptionInfoCard>
        <ReceptionInfoCard title="Sécurité" variant="warning">
          <p>
            Vérifiez toujours le résumé avant application. L&apos;annulation reste disponible seulement tant qu&apos;aucune
            nouvelle activité n&apos;est liée au membre importé.
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
          sessions={sessions.map((session) => ({
            id: session.id,
            groupId: session.groupId,
            groupName: session.group.name,
            sessionDate: session.sessionDate.toISOString(),
            startTime: session.startTime,
          }))}
        />
      </div>
    </main>
  );
}
