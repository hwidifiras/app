import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { GroupListClient } from "@/components/groups/group-list-client";
import { GroupDto } from "@/types/group";
import { PageHeader } from "@/components/ui/page-header";

export default async function GroupsPage() {
  let hasGroupDataError = false;
  let initialGroups: GroupDto[] = [];

  try {
    const groups = await prisma.group.findMany({
      include: {
        sport: { select: { name: true } },
        coach: { select: { firstName: true, lastName: true } },
        schedules: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    initialGroups = groups.map((group) => ({
      id: group.id,
      name: group.name,
      sportId: group.sportId,
      sportName: group.sport.name,
      coachId: group.coachId,
      coachName: `${group.coach.firstName} ${group.coach.lastName}`,
      capacity: group.capacity,
      room: group.room,
      isActive: group.isActive,
      schedules: group.schedules.map((s) => ({
        id: s.id,
        dayOfWeek: s.dayOfWeek as GroupDto["schedules"][number]["dayOfWeek"],
        startTime: s.startTime,
        durationMinutes: s.durationMinutes,
        effectiveFrom: s.effectiveFrom.toISOString(),
        effectiveTo: s.effectiveTo?.toISOString() ?? null,
      })),
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    }));
  } catch (error: unknown) {
    hasGroupDataError = true;
    console.error("Groups page degraded mode due to Prisma model mismatch:", error);
  }

  if (hasGroupDataError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Gestion des groupes indisponible</h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Le modèle Prisma Group n&apos;est pas accessible pour le moment. Lancez la régénération du client
            (`npm run prisma:generate`) puis redémarrez le serveur de développement.
          </p>
          <div className="mt-4">
            <Link href="/" className="btn btn-ghost">
              Retour au dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Référentiels"
        title="Liste des groupes"
        description="Consulter, modifier ou supprimer les groupes d'entraînement."
      />

      <section className="panel p-5">
        <GroupListClient initialGroups={initialGroups} />
      </section>
    </main>
  );
}
