import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { CheckInPanel } from "@/components/attendance/check-in-panel";
import { getClubSettings } from "@/lib/club-settings";
import { canCheckInWithPayment } from "@/lib/membership-rules";
import { computeWeeklyAllowanceRemainingForMember } from "@/lib/weekly-session-consumption";
import { getAppTimeZone, utcDateOnlyForTimeZone } from "@/lib/dates";
import { isDemoTenantSlug } from "@/lib/demo-workspace";
import { isDateWithinBusinessDayWindow } from "@/lib/assignment-policy";
import {
  deriveSessionLifecycle,
  expectedMemberIdsAtSession,
} from "@/lib/session-lifecycle";
import Link from "next/link";
import { getAuthUser } from "@/lib/request-user";
import { coachSessionWhere } from "@/modules/classes/coach-scope";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AttendanceTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const { sessionId: requestedSessionId } = await searchParams;
  const authUser = await getAuthUser();

  if (!authUser) {
    return (
      <main className="app-shell py-4 md:py-8">
        <PageHeader
          overline="Aujourd'hui"
          title="Pointage"
          description="Connectez-vous pour effectuer le pointage."
        />
        <section className="panel panel-soft p-5">
          <p className="text-sm text-[var(--muted-foreground)]">Accès refusé.</p>
        </section>
      </main>
    );
  }

  const tenantId = authUser.tenantId;
  const now = new Date();
  const appTimeZone = getAppTimeZone();
  const today = utcDateOnlyForTimeZone(now, appTimeZone);
  const currentTimeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: appTimeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const currentMinutes =
    Number(currentTimeParts.find((part) => part.type === "hour")?.value ?? 0) * 60
    + Number(currentTimeParts.find((part) => part.type === "minute")?.value ?? 0);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const upcomingUntil = new Date(tomorrow);
  upcomingUntil.setUTCDate(upcomingUntil.getUTCDate() + 7);
  const overdueSince = new Date(today);
  overdueSince.setUTCDate(overdueSince.getUTCDate() - 30);

  let sessions = [] as Array<{
    id: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    room: string;
    status: string;
    operationalStatus: "UPCOMING" | "NEEDS_FINALIZATION" | "COMPLETED" | "CANCELLED";
    dateCategory: "OVERDUE" | "TODAY" | "UPCOMING";
    expectedMemberCount: number;
    checkedMemberCount: number;
    unmarkedCount: number;
    ended: boolean;
    canFinalize: boolean;
    postponedTo: string | null;
    postponementDetails: string | null;
    group: {
      id: string;
      name: string;
      members: Array<{
        id: string;
        memberId: string;
        member: { id: string; firstName: string; lastName: string };
      }>;
    };
    coach: { firstName: string; lastName: string } | null;
    attendances: Array<{
      id: string;
      memberId: string;
      status: string;
      overrideReason?: string | null;
      checkedAt: string;
    }>;
  }>;
  let activeSubscriptionMemberIds: string[] = [];
  let partialPaymentMemberIds: string[] = [];
  let partialPaymentDebtsCents: Record<string, number> = {};
  let hasError = false;

  try {
    const rawSessions = await prisma.session.findMany({
      where: {
        tenantId,
        ...coachSessionWhere(authUser),
        sessionDate: { gte: overdueSince, lt: upcomingUntil },
        status: { in: ["PLANNED", "RESCHEDULED", "COMPLETED"] },
      },
      include: {
        group: {
          include: {
            sport: { select: { id: true } },
            members: {
              where: {
                tenantId,
                status: "ACTIVE",
                member: { tenantId, status: "ACTIVE" },
              },
              include: {
                member: { select: { id: true, firstName: true, lastName: true, status: true } },
              },
            },
          },
        },
        coach: { select: { firstName: true, lastName: true } },
        attendances: {
          where: { tenantId },
          select: { id: true, memberId: true, status: true, overrideReason: true, checkedAt: true },
          orderBy: { checkedAt: "asc" },
        },
      },
      orderBy: { startTime: "asc" },
    });

    const visibleSessions = rawSessions.flatMap((session) => {
      const expectedMemberIds = expectedMemberIdsAtSession(session.group.members, session.sessionDate);
      const lifecycle = deriveSessionLifecycle({
        status: session.status,
        sessionDate: session.sessionDate,
        endTime: session.endTime,
        expectedMemberIds,
        attendanceMemberIds: session.attendances.map((attendance) => attendance.memberId),
      });
      const isToday = session.sessionDate >= today && session.sessionDate < tomorrow;
      const isUpcoming = session.sessionDate >= tomorrow && session.sessionDate < upcomingUntil;
      const dateCategory: "TODAY" | "UPCOMING" | "OVERDUE" = isToday
        ? "TODAY"
        : isUpcoming
          ? "UPCOMING"
          : "OVERDUE";
      const explicitlyRequested = requestedSessionId === session.id;
      if (isUpcoming && session.status === "COMPLETED" && !explicitlyRequested) {
        return [];
      }
      if (!isToday && !isUpcoming && lifecycle.operationalStatus !== "NEEDS_FINALIZATION" && !explicitlyRequested) {
        return [];
      }
      const expectedIds = new Set(expectedMemberIds);
      return [{
        ...session,
        ...lifecycle,
        dateCategory,
        sessionDate: session.sessionDate.toISOString(),
        postponedTo: session.postponedTo ? session.postponedTo.toISOString() : null,
        postponementDetails: session.postponementDetails ?? null,
        group: {
          ...session.group,
          members: session.group.members.filter((member) => expectedIds.has(member.memberId)),
        },
        attendances: session.attendances.map((attendance) => ({
          ...attendance,
          checkedAt: attendance.checkedAt.toISOString(),
        })),
      }];
    });
    sessions = visibleSessions.sort((left, right) => {
      const categoryPriority = { TODAY: 0, UPCOMING: 1, OVERDUE: 2 } as const;
      const leftPriority = categoryPriority[left.dateCategory];
      const rightPriority = categoryPriority[right.dateCategory];
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return left.sessionDate.localeCompare(right.sessionDate) || left.startTime.localeCompare(right.startTime);
    });

    // Collect all member IDs from sessions to check subscriptions
    const memberIds = Array.from(
      new Set(rawSessions.flatMap((s) => s.group.members.map((gm) => gm.memberId)))
    );

    if (memberIds.length > 0) {
      const subs = await prisma.memberSubscription.findMany({
        where: {
          tenantId,
          memberId: { in: memberIds },
          status: { in: ["ACTIVE", "EXPIRED"] },
          OR: [
            { remainingSessions: { gt: 0 } },
            { entitlements: { some: { type: "CLASS_SESSIONS", remainingUnits: { gt: 0 } } } },
          ],
        },
        select: { 
          id: true,
          memberId: true,
          startDate: true,
          endDate: true,
          amount: true,
          remainingSessions: true,
          payments: { where: { tenantId }, select: { amount: true } },
          plan: { select: { sportId: true, sessionsPerWeek: true, name: true } }
          ,entitlements: { where: { type: "CLASS_SESSIONS" }, select: { id: true, sportId: true, sessionsPerWeek: true, remainingUnits: true } }
        },
      });

      const clubSettings = await getClubSettings();
      const validKeys = new Set<string>();
      const partialKeys = new Set<string>();
      const partialDebtByKey = new Map<string, number>();

      for (const session of rawSessions) {
        const sessionSportId = session.group.sportId;

        for (const member of session.group.members) {
          const memberSubs = subs.filter(
            (s) =>
              s.memberId === member.memberId &&
              isDateWithinBusinessDayWindow(s.startDate, s.endDate, session.sessionDate),
          );

          const matchedSub = await (async () => {
            for (const sub of memberSubs) {
              const totalPaid = sub.payments.reduce((acc, p) => acc + p.amount, 0);
              const classRight = sub.entitlements.find((right) => right.sportId === sessionSportId && (right.remainingUnits ?? 0) > 0);
              if (sub.plan.sportId && sub.plan.sportId !== sessionSportId) continue;
              if (!sub.plan.sportId && !classRight) continue;
              const sessionsPerWeek = classRight?.sessionsPerWeek ?? sub.plan.sessionsPerWeek;

              const paymentCheck = await canCheckInWithPayment({
                id: sub.id,
                entitlementId: classRight?.id ?? null,
                sportId: sub.plan.sportId ?? sessionSportId,
                remainingSessions: classRight?.remainingUnits ?? sub.remainingSessions,
                amount: sub.amount,
                totalPaid,
                plan: { ...sub.plan, sportId: sub.plan.sportId ?? sessionSportId, sessionsPerWeek },
              });
              if (!paymentCheck.allowed) continue;

              if (sessionsPerWeek) {
                const weeklyRemaining = await computeWeeklyAllowanceRemainingForMember({
                  sessionId: session.id,
                  groupId: session.groupId,
                  sessionDate: session.sessionDate,
                  memberId: sub.memberId,
                  memberSubscriptionId: sub.id,
                  planSessionsPerWeek: sessionsPerWeek,
                  absentConsumesSession: clubSettings.absentConsumesSession,
                });
                if (weeklyRemaining <= 0) continue;
              }

              return { sub, totalPaid };
            }
            return null;
          })();

          if (matchedSub) {
            const key = `${session.id}_${member.memberId}`;
            validKeys.add(key);
            if (matchedSub.totalPaid < matchedSub.sub.amount) {
              partialKeys.add(key);
              partialDebtByKey.set(key, matchedSub.sub.amount - matchedSub.totalPaid);
            }
          }
        }
      }

      activeSubscriptionMemberIds = Array.from(validKeys);
      partialPaymentMemberIds = Array.from(partialKeys);
      partialPaymentDebtsCents = Object.fromEntries(partialDebtByKey);
    }
  } catch {
    hasError = true;
  }

  if (hasError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Pointage indisponible</h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Cette page ne peut pas charger ses données pour le moment. Revenez au tableau de bord puis contactez le
            support si le problème continue.
          </p>
          <div className="mt-4">
            <Link href="/attendance" className="btn btn-ghost">Retour aux présences</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="attendance-page app-shell py-0 md:py-0">
      <section className="attendance-page-surface">
        <CheckInPanel
          data={{
            sessions,
            todayIso: today.toISOString(),
            currentMinutes,
            appTimeZone,
            readOnly: isDemoTenantSlug(authUser.tenantSlug),
            activeSubscriptionMemberIds,
            partialPaymentMemberIds,
            partialPaymentDebtsCents,
          }}
          initialSessionId={requestedSessionId}
        />
      </section>
    </main>
  );
}
