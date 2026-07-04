import { headers } from "next/headers";

import { DataImportWizard } from "@/components/settings/data-import-wizard";
import { PageHeader } from "@/components/ui/page-header";
import { getWeekRangeUtc } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DataImportPage() {
  const requestHeaders = await headers();
  if (requestHeaders.get("x-user-role") !== "ADMIN") {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Administration"
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
      where: { isActive: true },
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
      where: { isActive: true },
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
        overline="Administration"
        title="Import ancien fichier"
        description="Importer l'état réel d'un adhérent actif depuis un registre papier ou Excel, sans recréer artificiellement un abonnement neuf."
      />
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
