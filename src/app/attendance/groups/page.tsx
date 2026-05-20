import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDate(value: Date) {
  return value.toLocaleDateString("fr-FR");
}

function formatDateInput(value: Date) {
  return value.toISOString().split("T")[0] ?? "";
}

function statusVariant(status: string) {
  if (status === "PLANNED") return "info";
  if (status === "RESCHEDULED") return "warning";
  if (status === "COMPLETED") return "success";
  if (status === "CANCELLED") return "danger";
  return "muted";
}

export default async function AttendanceByGroupPage({
  searchParams,
}: {
  searchParams: Promise<{ groupId?: string; from?: string; to?: string }>;
}) {
  const { groupId, from, to } = await searchParams;

  const defaultTo = new Date();
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 14);

  const fromDate = from ? new Date(from) : defaultFrom;
  const toDate = to ? new Date(to) : defaultTo;
  toDate.setHours(23, 59, 59, 999);

  const groups = await prisma.group.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const sessions = await prisma.session.findMany({
    where: {
      ...(groupId ? { groupId } : {}),
      sessionDate: { gte: fromDate, lte: toDate },
    },
    include: {
      group: { select: { id: true, name: true } },
      coach: { select: { firstName: true, lastName: true } },
      attendances: { select: { status: true } },
    },
    orderBy: [{ group: { name: "asc" } }, { sessionDate: "desc" }, { startTime: "asc" }],
    take: 500,
  });

  const grouped = new Map<
    string,
    {
      groupId: string;
      groupName: string;
      rows: Array<{
        id: string;
        date: Date;
        startTime: string;
        endTime: string;
        status: string;
        coachName: string;
        present: number;
        absent: number;
        override: number;
        total: number;
      }>;
    }
  >();

  for (const session of sessions) {
    const present = session.attendances.filter((a) => a.status === "PRESENT").length;
    const absent = session.attendances.filter((a) => a.status === "ABSENT").length;
    const override = session.attendances.filter((a) => a.status === "OVERRIDE").length;
    const total = present + absent + override;
    const coachName = session.coach ? `${session.coach.firstName} ${session.coach.lastName}` : "-";

    if (!grouped.has(session.groupId)) {
      grouped.set(session.groupId, {
        groupId: session.groupId,
        groupName: session.group.name,
        rows: [],
      });
    }

    grouped.get(session.groupId)?.rows.push({
      id: session.id,
      date: session.sessionDate,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      coachName,
      present,
      absent,
      override,
      total,
    });
  }

  return (
    <main className="app-shell py-4 md:py-8">
      <Link
        href="/attendance"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        Retour aux presences
      </Link>

      <PageHeader
        overline="Suivi"
        title="Presences par groupe"
        description="Suivi des presences par groupe et par seance."
      />

      <section className="panel p-5">
        <form className="mb-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <select name="groupId" defaultValue={groupId ?? ""} className="field text-sm">
            <option value="">Tous les groupes</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <input name="from" type="date" defaultValue={formatDateInput(fromDate)} className="field text-sm" />
          <input name="to" type="date" defaultValue={formatDateInput(toDate)} className="field text-sm" />
          <button type="submit" className="btn btn-primary">Filtrer</button>
        </form>

        {grouped.size === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">Aucune seance sur cette periode.</p>
        ) : (
          <div className="space-y-4">
            {Array.from(grouped.values()).map((group) => (
              <details key={group.groupId} className="rounded-xl border border-[var(--border)] bg-[var(--surface)]" open>
                <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
                  <span>{group.groupName}</span>
                  <span className="text-xs text-[var(--muted-foreground)]">{group.rows.length} seance(s)</span>
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--surface-soft)] text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Date</th>
                        <th className="px-4 py-3 text-left font-semibold">Horaire</th>
                        <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">Coach</th>
                        <th className="px-4 py-3 text-center font-semibold">Present</th>
                        <th className="px-4 py-3 text-center font-semibold">Absent</th>
                        <th className="px-4 py-3 text-center font-semibold hidden sm:table-cell">Exception</th>
                        <th className="px-4 py-3 text-center font-semibold">Total</th>
                        <th className="px-4 py-3 text-right font-semibold">Statut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {group.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-[var(--surface-soft)] transition-colors">
                          <td className="px-4 py-3" data-label="Date">{formatDate(row.date)}</td>
                          <td className="px-4 py-3" data-label="Horaire">
                            {row.startTime} - {row.endTime}
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell" data-label="Coach">{row.coachName}</td>
                          <td className="px-4 py-3 text-center" data-label="Present">{row.present}</td>
                          <td className="px-4 py-3 text-center" data-label="Absent">{row.absent}</td>
                          <td className="px-4 py-3 text-center hidden sm:table-cell" data-label="Exception">{row.override}</td>
                          <td className="px-4 py-3 text-center" data-label="Total">{row.total}</td>
                          <td className="px-4 py-3 text-right" data-label="Statut">
                            <StatusBadge variant={statusVariant(row.status)}>{row.status}</StatusBadge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
