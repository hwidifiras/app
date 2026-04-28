import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AttendanceStatus } from "@prisma/client";

function statusVariant(status: AttendanceStatus) {
  switch (status) {
    case "PRESENT": return "success";
    case "ABSENT": return "danger";
    case "EXCUSED": return "info";
    case "OVERRIDE": return "warning";
    default: return "muted";
  }
}
function statusLabel(status: AttendanceStatus) {
  switch (status) {
    case "PRESENT": return "Présent";
    case "ABSENT": return "Absent";
    case "EXCUSED": return "Excusé";
    case "OVERRIDE": return "Exception";
    default: return status;
  }
}

export default async function AttendancePage() {
  let hasError = false;
  let rows: Array<{
    id: string;
    memberName: string;
    groupName: string;
    sessionDate: string;
    startTime: string;
    status: AttendanceStatus;
    overrideReason: string | null;
    checkedBy: string | null;
    checkedAt: string;
  }> = [];

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
      />

      <section className="panel p-5">
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Membre</th>
                <th className="px-4 py-3 text-left font-semibold">Groupe</th>
                <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">Séance</th>
                <th className="px-4 py-3 text-left font-semibold">Statut</th>
                <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Pointage</th>
                <th className="px-4 py-3 text-left font-semibold hidden lg:table-cell">Motif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[var(--surface-soft)] transition-colors">
                  <td className="px-4 py-3 font-medium text-[var(--foreground)]">{r.memberName}</td>
                  <td className="px-4 py-3">{r.groupName}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {new Date(r.sessionDate).toLocaleDateString("fr-FR")}
                    <span className="text-[var(--muted-foreground)] ml-1">({r.startTime})</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={statusVariant(r.status)}>{statusLabel(r.status)}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-[var(--muted-foreground)]">
                    {r.checkedBy ?? "Système"} — {new Date(r.checkedAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-[var(--muted-foreground)]">
                    {r.overrideReason ?? "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-5 text-center text-[var(--muted-foreground)]">
                    Aucune présence enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
