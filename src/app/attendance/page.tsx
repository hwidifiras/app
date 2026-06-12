import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import {
  AttendanceHistoryList,
  type AttendanceHistoryRow,
} from "@/components/attendance/attendance-history-list";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AttendancePage() {
  let hasError = false;
  let rows: AttendanceHistoryRow[] = [];

  try {
    const data = await prisma.attendance.findMany({
      orderBy: { checkedAt: "desc" },
      take: 200,
      include: {
        session: { select: { sessionDate: true, startTime: true, group: { select: { name: true } } } },
        member: { select: { firstName: true, lastName: true } },
      },
    });
    rows = data.map((a) => ({
      id: a.id,
      memberName: `${a.member.firstName} ${a.member.lastName}`,
      groupName: a.session.group?.name ?? "—",
      sessionDate: a.session.sessionDate.toISOString(),
      startTime: a.session.startTime,
      status: a.status,
      overrideReason: a.overrideReason,
      checkedBy: a.checkedBy,
      checkedAt: a.checkedAt.toISOString(),
    }));
  } catch (error) {
    hasError = true;
    console.error("Attendance page degraded mode:", error);
  }

  if (hasError) {
    return (
      <main className="app-shell py-6">
        <div className="panel panel-soft p-6">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted-foreground)]">Mode dégradé</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Présences indisponibles</h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Données inaccessibles. Lancez `npm run prisma:generate` puis redémarrez le serveur.
          </p>
          <div className="mt-4">
            <Link href="/" className="btn btn-ghost">Retour au dashboard</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <PageHeader
        overline="Suivi"
        title="Présences"
        description={`${rows.length} pointage(s) enregistré(s).`}
        actions={
          <>
            <Link href="/attendance/groups" className="btn btn-ghost btn-block-mobile min-h-11 text-sm sm:w-auto">
              Rapport par groupe
            </Link>
            <Link href="/attendance/today" className="btn btn-primary btn-block-mobile min-h-11 text-sm sm:w-auto">
              Pointer aujourd&apos;hui
            </Link>
          </>
        }
      />

      <section className="panel p-3 sm:p-5">
        <AttendanceHistoryList rows={rows} />
      </section>
    </main>
  );
}
