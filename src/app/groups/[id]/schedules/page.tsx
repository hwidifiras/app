import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { GroupSchedulesManager } from "@/components/groups/group-schedules-manager";
import { PageHeader } from "@/components/ui/page-header";

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
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Planning indisponible</h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
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
    <main className="app-shell py-4 md:py-8">
      <Link
        href="/groups"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Retour à la liste
      </Link>

      <PageHeader
        overline="Planification"
        title={group.name}
        description={`${group.sport.name} — Coach ${group.coach.firstName} ${group.coach.lastName} — Salle ${group.room}`}
        actions={
          <Link href={`/groups/${group.id}/edit`} className="btn btn-ghost text-sm">
            Modifier groupe
          </Link>
        }
      />

      <GroupSchedulesManager groupId={group.id} initialSchedules={scheduleRows} />
    </main>
  );
}
