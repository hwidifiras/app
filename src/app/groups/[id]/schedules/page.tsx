import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { GroupSchedulesManager } from "@/components/groups/group-schedules-manager";

export default async function GroupSchedulesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let group: {
    id: string;
    name: string;
    room: string;
    coachId: string;
    capacity: number;
    sportId: string;
    sport: { name: string };
    coach: { firstName: string; lastName: string };
    schedules: Array<{
      id: string;
      dayOfWeek: string;
      startTime: string;
      durationMinutes: number;
      effectiveFrom: Date;
      effectiveTo: Date | null;
      createdAt: Date;
    }>;
  } | null = null;

  try {
    group = await prisma.group.findUnique({
      where: { id },
      include: {
        sport: { select: { name: true } },
        coach: { select: { firstName: true, lastName: true } },
        schedules: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  } catch {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Planning indisponible</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Le modèle Prisma n&apos;est pas accessible pour le moment. Lancez la régénération du client
            (`npm run prisma:generate`) puis redémarrez le serveur de développement.
          </p>
          <div className="mt-4">
            <Link href="/groups" className="btn btn-ghost">
              Retour aux groupes
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!group) {
    notFound();
  }

  const scheduleRows = group.schedules.map((s) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    durationMinutes: s.durationMinutes,
    effectiveFrom: s.effectiveFrom.toISOString(),
    effectiveTo: s.effectiveTo?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <main className="app-shell py-6">
      <div className="mb-7 flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Groupe</p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{group.name}</h1>
        <p className="text-sm text-[var(--muted)]">
          {group.sport.name} — Coach {group.coach.firstName} {group.coach.lastName} — Salle {group.room}
        </p>
      </div>

      <div className="mb-5 flex items-center gap-2">
        <Link href={`/groups/${group.id}/edit`} className="btn btn-ghost">
          Modifier groupe
        </Link>
        <Link href="/groups" className="btn btn-ghost">
          Retour aux groupes
        </Link>
      </div>

      <GroupSchedulesManager groupId={group.id} initialSchedules={scheduleRows} />
    </main>
  );
}
