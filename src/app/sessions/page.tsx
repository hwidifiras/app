import Link from "next/link";

import { SessionsPlanner } from "@/components/sessions/sessions-planner";
import { prisma } from "@/lib/prisma";

function startOfWeek(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  const mondayDelta = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + mondayDelta);
  return copy;
}

function toDateOnlyIso(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return `${copy.getFullYear()}-${String(copy.getMonth() + 1).padStart(2, "0")}-${String(copy.getDate()).padStart(2, "0")}`;
}

export default async function SessionsPage() {
  let hasSessionsDataError = false;

  const monday = startOfWeek(new Date());
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  let initialSessions: Array<{
    id: string;
    groupId: string;
    groupName: string;
    scheduleId: string | null;
    sessionDate: string;
    startTime: string;
    endTime: string;
    coachId: string | null;
    coachName: string | null;
    room: string;
    status: "PLANNED" | "RESCHEDULED" | "CANCELLED" | "COMPLETED";
    exceptionReason: string | null;
    createdAt: string;
    updatedAt: string;
  }> = [];

  let groupsOptions: Array<{ id: string; name: string }> = [];
  let coachesOptions: Array<{ id: string; firstName: string; lastName: string }> = [];

  try {
    const [sessions, groups, coaches] = await Promise.all([
      prisma.session.findMany({
        where: {
          sessionDate: {
            gte: monday,
            lte: sunday,
          },
        },
        include: {
          group: { select: { name: true } },
          coach: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
        take: 300,
      }),
      prisma.group.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.coach.findMany({
        where: { isActive: true },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
    ]);

    initialSessions = sessions.map((session) => ({
      id: session.id,
      groupId: session.groupId,
      groupName: session.group.name,
      scheduleId: session.scheduleId,
      sessionDate: session.sessionDate.toISOString(),
      startTime: session.startTime,
      endTime: session.endTime,
      coachId: session.coachId,
      coachName: session.coach ? `${session.coach.firstName} ${session.coach.lastName}` : null,
      room: session.room,
      status: session.status,
      exceptionReason: session.exceptionReason,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    }));

    groupsOptions = groups;
    coachesOptions = coaches;
  } catch (error) {
    hasSessionsDataError = true;
    console.error("Sessions page degraded mode due to Prisma model mismatch:", error);
  }

  if (hasSessionsDataError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Planning des séances indisponible</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Le modèle Prisma Session n&apos;est pas accessible pour le moment. Lancez la régénération du client
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
    <main>
      <SessionsPlanner
        initialSessions={initialSessions}
        groupsOptions={groupsOptions}
        coachesOptions={coachesOptions}
        initialWeekStart={toDateOnlyIso(monday)}
      />
    </main>
  );
}
