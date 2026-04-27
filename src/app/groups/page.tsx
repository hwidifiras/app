import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { GroupListClient } from "@/components/groups/group-list-client";

export default async function GroupsPage() {
  let hasGroupDataError = false;
  let initialGroups: Array<{
    id: string;
    name: string;
    sportId: string;
    sportName: string;
    coachId: string;
    coachName: string;
    capacity: number;
    room: string;
    isActive: boolean;
    schedule: {
      dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
      startTime: string;
      durationMinutes: number;
      effectiveFrom: string;
      effectiveTo: string | null;
    } | null;
    createdAt: string;
    updatedAt: string;
  }> = [];

  try {
    const groups = await prisma.group.findMany({
      include: {
        sport: { select: { name: true } },
        coach: { select: { firstName: true, lastName: true } },
        schedules: { orderBy: { createdAt: "asc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    initialGroups = groups.map((group) => {
      const schedule = group.schedules[0] ?? null;
      return {
        id: group.id,
        name: group.name,
        sportId: group.sportId,
        sportName: group.sport.name,
        coachId: group.coachId,
        coachName: `${group.coach.firstName} ${group.coach.lastName}`,
        capacity: group.capacity,
        room: group.room,
        isActive: group.isActive,
        schedule: schedule
          ? {
              dayOfWeek: schedule.dayOfWeek,
              startTime: schedule.startTime,
              durationMinutes: schedule.durationMinutes,
              effectiveFrom: schedule.effectiveFrom.toISOString(),
              effectiveTo: schedule.effectiveTo?.toISOString() ?? null,
            }
          : null,
        createdAt: group.createdAt.toISOString(),
        updatedAt: group.updatedAt.toISOString(),
      };
    });
  } catch (error) {
    hasGroupDataError = true;
    console.error("Groups page degraded mode due to Prisma model mismatch:", error);
  }

  if (hasGroupDataError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Gestion des groupes indisponible</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
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
      <div className="mb-5 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Parcours réception</p>
        <h1 className="text-2xl font-semibold text-[var(--foreground)] md:text-3xl">Liste des groupes</h1>
        <p className="text-sm text-[var(--muted)]">
          Consulter, modifier ou supprimer les groupes d&apos;entraînement.
        </p>
      </div>

      <section className="panel p-5">
        <GroupListClient initialGroups={initialGroups} />
      </section>
    </main>
  );
}
