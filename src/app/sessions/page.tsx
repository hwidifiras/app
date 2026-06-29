import Link from "next/link";

import { SessionsPlanner } from "@/components/sessions/sessions-planner";
import { getWeekRangeFromStartIso, weekStartIsoForDate } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import {
  deriveSessionLifecycle,
  expectedMemberIdsAtSession,
} from "@/lib/session-lifecycle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; groupId?: string; sessionId?: string }>;
}) {
  let hasSessionsDataError = false;

  const { week: weekParam, groupId: groupIdParam, sessionId: sessionIdParam } = await searchParams;
  const initialWeekStart =
    weekParam && /^\d{4}-\d{2}-\d{2}$/.test(weekParam) ? weekParam : weekStartIsoForDate(new Date());
  const { start: weekStart, end: weekEndExclusive } = getWeekRangeFromStartIso(initialWeekStart);

  let initialSessions: Array<{
    id: string;
    groupId: string;
    groupName: string;
    groupSportId: string;
    scheduleId: string | null;
    sessionDate: string;
    startTime: string;
    endTime: string;
    coachId: string | null;
    coachName: string | null;
    room: string;
    status: "PLANNED" | "RESCHEDULED" | "CANCELLED" | "COMPLETED";
    exceptionReason: string | null;
    postponedTo: string | null;
    postponementReason: string | null;
    postponementDetails: string | null;
    attendanceCount: number;
    operationalStatus: "UPCOMING" | "NEEDS_FINALIZATION" | "COMPLETED" | "CANCELLED";
    expectedMemberCount: number;
    checkedMemberCount: number;
    unmarkedCount: number;
    ended: boolean;
    canFinalize: boolean;
    createdAt: string;
    updatedAt: string;
  }> = [];

  let groupsOptions: Array<{ id: string; name: string; sportId: string }> = [];
  let coachesOptions: Array<{
    id: string;
    firstName: string;
    lastName: string;
    qualifiedSportIds: string[];
    qualifiedSports: Array<{ id: string; name: string; isPrimary: boolean }>;
  }> = [];

  try {
    const [sessions, groups, coaches] = await Promise.all([
      prisma.session.findMany({
        where: {
          sessionDate: {
            gte: weekStart,
            lt: weekEndExclusive,
          },
          ...(groupIdParam ? { groupId: groupIdParam } : {}),
        },
        include: {
          group: {
            select: {
              name: true,
              sportId: true,
              members: {
                select: { memberId: true, startDate: true, endDate: true },
              },
            },
          },
          coach: { select: { firstName: true, lastName: true } },
          attendances: { select: { memberId: true } },
          _count: { select: { attendances: true } },
        },
        orderBy: [{ sessionDate: "asc" }, { startTime: "asc" }],
        take: 300,
      }),
      prisma.group.findMany({
        where: { isActive: true },
        select: { id: true, name: true, sportId: true },
        orderBy: { name: "asc" },
      }),
      prisma.coach.findMany({
        where: { isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          sportId: true,
          sport: { select: { id: true, name: true } },
          qualifications: {
            include: { sport: { select: { id: true, name: true } } },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      }),
    ]);

    initialSessions = sessions.map((session) => {
      const lifecycle = deriveSessionLifecycle({
        status: session.status,
        sessionDate: session.sessionDate,
        endTime: session.endTime,
        expectedMemberIds: expectedMemberIdsAtSession(session.group.members, session.sessionDate),
        attendanceMemberIds: session.attendances.map((attendance) => attendance.memberId),
      });
      return {
        id: session.id,
        groupId: session.groupId,
        groupName: session.group.name,
        groupSportId: session.group.sportId,
        scheduleId: session.scheduleId,
        sessionDate: session.sessionDate.toISOString(),
        startTime: session.startTime,
        endTime: session.endTime,
        coachId: session.coachId,
        coachName: session.coach ? `${session.coach.firstName} ${session.coach.lastName}` : null,
        room: session.room,
        status: session.status,
        exceptionReason: session.exceptionReason,
        postponedTo: session.postponedTo ? session.postponedTo.toISOString() : null,
        postponementReason: session.postponementReason,
        postponementDetails: session.postponementDetails,
        attendanceCount: session._count.attendances,
        ...lifecycle,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      };
    });

    groupsOptions = groups;
    coachesOptions = coaches.map((coach) => {
      const qualifiedSportsById = new Map<string, { id: string; name: string; isPrimary: boolean }>();
      for (const qualification of coach.qualifications) {
        qualifiedSportsById.set(qualification.sport.id, {
          id: qualification.sport.id,
          name: qualification.sport.name,
          isPrimary: qualification.isPrimary,
        });
      }
      if (coach.sport) {
        qualifiedSportsById.set(coach.sport.id, {
          id: coach.sport.id,
          name: coach.sport.name,
          isPrimary: true,
        });
      }
      const qualifiedSports = Array.from(qualifiedSportsById.values()).sort((a, b) => {
        if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
        return a.name.localeCompare(b.name, "fr");
      });
      return {
        id: coach.id,
        firstName: coach.firstName,
        lastName: coach.lastName,
        qualifiedSportIds: qualifiedSports.map((sport) => sport.id),
        qualifiedSports,
      };
    });
  } catch (error) {
    hasSessionsDataError = true;
    console.error("Sessions page degraded mode due to Prisma model mismatch:", error);
  }

  if (hasSessionsDataError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Planning des séances indisponible</h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Cette page ne peut pas charger ses données pour le moment. Revenez au tableau de bord puis contactez le
            support si le problème continue.
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
        overline="Planning"
        title="Planning"
        description="Voir les séances, filtrer par cours et ouvrir le pointage."
      />
      <SessionsPlanner
        initialSessions={initialSessions}
        groupsOptions={groupsOptions}
        coachesOptions={coachesOptions}
        initialWeekStart={initialWeekStart}
        initialGroupId={groupIdParam ?? ""}
        initialSessionId={sessionIdParam ?? ""}
      />
    </main>
  );
}
