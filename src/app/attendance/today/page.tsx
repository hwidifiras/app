import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { CheckInPanel } from "@/components/attendance/check-in-panel";
import { getClubSettings } from "@/lib/club-settings";
import { computeWeeklyAllowanceRemainingForMember } from "@/lib/weekly-session-consumption";
import { utcDateOnlyForTimeZone } from "@/lib/dates";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AttendanceTodayPage() {
  const today = utcDateOnlyForTimeZone(new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  let sessions = [] as Array<{
    id: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    room: string;
    status: string;
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
    attendances: Array<{ id: string; memberId: string; status: string; overrideReason?: string | null }>;
  }>;
  let activeSubscriptionMemberIds: string[] = [];
  let hasError = false;

  try {
    const rawSessions = await prisma.session.findMany({
      where: {
        sessionDate: { gte: today, lt: tomorrow },
        status: { in: ["PLANNED", "RESCHEDULED", "COMPLETED"] },
      },
      include: {
        group: {
          include: {
            sport: { select: { id: true } },
            members: {
              where: { status: "ACTIVE" },
              include: {
                member: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
        coach: { select: { firstName: true, lastName: true } },
        attendances: { select: { id: true, memberId: true, status: true, overrideReason: true } },
      },
      orderBy: { startTime: "asc" },
    });

    sessions = rawSessions.map((s) => ({
      ...s,
      sessionDate: s.sessionDate.toISOString(),
      postponedTo: s.postponedTo ? s.postponedTo.toISOString() : null,
      postponementDetails: s.postponementDetails ?? null,
    }));

    // Collect all member IDs from sessions to check subscriptions
    const memberIds = Array.from(
      new Set(rawSessions.flatMap((s) => s.group.members.map((gm) => gm.memberId)))
    );

    if (memberIds.length > 0) {
      const now = new Date();
      const subs = await prisma.memberSubscription.findMany({
        where: {
          memberId: { in: memberIds },
          status: "ACTIVE",
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gte: now } }],
          remainingSessions: { gt: 0 },
        },
        select: { 
          id: true,
          memberId: true,
          amount: true,
          remainingSessions: true,
          payments: { select: { amount: true } },
          plan: { select: { sportId: true, sessionsPerWeek: true } }
        },
      });

      const clubSettings = await getClubSettings();
      const validKeys = new Set<string>();

      for (const session of rawSessions) {
        const sessionSportId = session.group.sportId;

        for (const member of session.group.members) {
          const memberSubs = subs.filter((s) => s.memberId === member.memberId);
          
          const hasValidSub = await (async () => {
            for (const sub of memberSubs) {
              const totalPaid = sub.payments.reduce((acc, p) => acc + p.amount, 0);
              if (totalPaid < sub.amount) continue;
              if (sub.plan.sportId && sub.plan.sportId !== sessionSportId) continue;

              if (sub.plan.sessionsPerWeek) {
                const weeklyRemaining = await computeWeeklyAllowanceRemainingForMember({
                  sessionId: session.id,
                  groupId: session.groupId,
                  sessionDate: session.sessionDate,
                  memberId: sub.memberId,
                  memberSubscriptionId: sub.id,
                  planSessionsPerWeek: sub.plan.sessionsPerWeek,
                  absentConsumesSession: clubSettings.absentConsumesSession,
                });
                if (weeklyRemaining <= 0) continue;
              }

              return true;
            }
            return false;
          })();

          if (hasValidSub) {
            validKeys.add(`${session.id}_${member.memberId}`);
          }
        }
      }

      activeSubscriptionMemberIds = Array.from(validKeys);
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
            Données inaccessibles. Lancez `npm run prisma:generate` puis redémarrez le serveur.
          </p>
          <div className="mt-4">
            <Link href="/attendance" className="btn btn-ghost">Retour aux présences</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href="/attendance"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <ArrowLeft className="size-3.5" /> Retour à l&apos;historique
      </Link>

      <PageHeader
        overline="Suivi"
        title="Pointage du jour"
        description={
          sessions.length === 0
            ? "Aucune séance planifiée aujourd'hui. Les séances sont générées automatiquement depuis les créneaux récurrents du groupe."
            : `${sessions.length} séance${sessions.length > 1 ? "s" : ""} planifiée${sessions.length > 1 ? "s" : ""} — sélectionnez une séance pour pointer les membres.`
        }
      />

      <section className="panel panel-soft p-4 md:p-6">
        <CheckInPanel data={{ sessions, activeSubscriptionMemberIds }} />
      </section>
    </main>
  );
}
